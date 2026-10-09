import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { HttpStatus, Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';

/** Les clés contiennent un identifiant unique : un objet publié ne change jamais. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** Bucket public S3 (MinIO en local) : photos des véhicules. */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(@Inject(APP_CONFIG) config: Env) {
    this.bucket = config.S3_BUCKET_PUBLIC;
    this.publicBaseUrl = config.MEDIA_PUBLIC_URL;
    this.client =
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
    this.client?.destroy();
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async putPublic(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.requireClient().send(
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
    if (this.client === null || keys.length === 0) {
      return;
    }
    try {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((key) => ({ Key: key })), Quiet: true },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Suppression S3 impossible (${keys.join(', ')}) : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private requireClient(): S3Client {
    if (this.client === null) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        'Le stockage des photos n’est pas configuré.',
      );
    }
    return this.client;
  }
}
