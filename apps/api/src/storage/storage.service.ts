import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';

/** Les clés contiennent un identifiant unique : un objet publié ne change jamais. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** Photos publiques : S3 (MinIO, Hetzner) ou Azure Blob, selon la configuration. */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly azure: BlobServiceClient | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(@Inject(APP_CONFIG) config: Env) {
    this.publicBaseUrl = config.MEDIA_PUBLIC_URL;
    if (config.AZURE_STORAGE_ACCOUNT !== '') {
      this.bucket = config.AZURE_STORAGE_CONTAINER;
      this.s3 = null;
      this.azure = new BlobServiceClient(
        `https://${config.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
        new StorageSharedKeyCredential(
          config.AZURE_STORAGE_ACCOUNT,
          config.AZURE_STORAGE_ACCESS_KEY,
        ),
      );
      return;
    }
    this.bucket = config.S3_BUCKET_PUBLIC;
    this.azure = null;
    this.s3 =
      config.S3_ENDPOINT === undefined
        ? null
        : new S3Client({
            endpoint: config.S3_ENDPOINT,
            region: config.S3_REGION,
            forcePathStyle: true,
            credentials: {
              accessKeyId: config.S3_ACCESS_KEY_ID,
              secretAccessKey: config.S3_SECRET_ACCESS_KEY,
            },
          });
  }

  onModuleDestroy(): void {
    this.s3?.destroy();
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async putPublic(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.azure !== null) {
      await this.azure
        .getContainerClient(this.bucket)
        .getBlockBlobClient(key)
        .uploadData(body, {
          blobHTTPHeaders: {
            blobContentType: contentType,
            blobCacheControl: IMMUTABLE_CACHE,
          },
        });
      return;
    }
    await this.requireS3().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE,
      }),
    );
  }

  /** Suppression best effort : un objet orphelin ne doit pas faire échouer l'action de l'agence. */
  async deletePublic(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    if (this.azure !== null) {
      const container = this.azure.getContainerClient(this.bucket);
      for (const key of keys) {
        try {
          await container.getBlockBlobClient(key).deleteIfExists();
        } catch (error) {
          this.warnDelete(key, error);
        }
      }
      return;
    }
    if (this.s3 === null) {
      return;
    }
    try {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((key) => ({ Key: key })), Quiet: true },
        }),
      );
    } catch (error) {
      this.warnDelete(keys.join(', '), error);
    }
  }

  private requireS3(): S3Client {
    if (this.s3 === null) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Le stockage des photos n’est pas configuré.',
      );
    }
    return this.s3;
  }

  private warnDelete(key: string, error: unknown): void {
    this.logger.warn(
      `Suppression du stockage impossible (${key}) : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
