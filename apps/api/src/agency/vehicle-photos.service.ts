import { randomUUID } from 'node:crypto';

import { VEHICLE_PHOTOS_MAX, type VehiclePhoto } from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';

import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  toVehiclePhoto,
  VEHICLE_PHOTOS_INCLUDE,
  vehiclePhotoKeys,
} from '../storage/vehicle-photos';
import { AgencyService } from './agency.service';

const LARGE_SIZE = 1600;
const SMALL_SIZE = 640;
const LOGO_SIZE = 512;
/** Environ 60 mégapixels : au-delà, l'image est refusée avant d'être décodée. */
const MAX_INPUT_PIXELS = 60_000_000;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

interface RenderedImage {
  data: Buffer;
  width: number;
  height: number;
}

function invalidImage(): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    'BAD_REQUEST',
    'Image illisible ou non prise en charge.',
    [{ path: 'file', message: 'INVALID_IMAGE' }],
  );
}

/** Décode réellement l'image : le type MIME annoncé n'est qu'un indice. */
async function decodeImage(input: Buffer): Promise<sharp.Sharp> {
  const source = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
  const { format } = await source.metadata();
  if (!ACCEPTED_FORMATS.has(format)) {
    throw invalidImage();
  }
  return source.rotate();
}

/**
 * Applique l'orientation EXIF puis produit deux WebP sans métadonnées (position GPS, appareil…).
 */
export async function renderVariants(
  input: Buffer,
): Promise<{ large: RenderedImage; small: RenderedImage }> {
  try {
    const oriented = await decodeImage(input);
    const render = async (size: number, quality: number): Promise<RenderedImage> => {
      const { data, info } = await oriented
        .clone()
        .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    };
    const [large, small] = await Promise.all([render(LARGE_SIZE, 82), render(SMALL_SIZE, 76)]);
    return { large, small };
  } catch (error) {
    throw error instanceof AppException ? error : invalidImage();
  }
}

/** Logo d'agence : un seul WebP sans métadonnées, transparence conservée. */
export async function renderLogo(input: Buffer): Promise<Buffer> {
  try {
    const oriented = await decodeImage(input);
    return await oriented
      .resize({ width: LOGO_SIZE, height: LOGO_SIZE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
  } catch (error) {
    throw error instanceof AppException ? error : invalidImage();
  }
}

/** Photos des véhicules de l'agence du propriétaire connecté. */
@Injectable()
export class VehiclePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly agency: AgencyService,
  ) {}

  private publicUrl = (key: string): string => this.storage.publicUrl(key);

  private async ownedVehicle(ownerId: string, vehicleId: string) {
    const agencyId = await this.agency.agencyIdFor(ownerId);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, agencyId },
      select: { id: true, agencyId: true },
    });
    if (vehicle === null) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    return vehicle;
  }

  async add(ownerId: string, vehicleId: string, file: Buffer): Promise<VehiclePhoto> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    const count = await this.prisma.vehiclePhoto.count({ where: { vehicleId: vehicle.id } });
    if (count >= VEHICLE_PHOTOS_MAX) {
      throw new AppException(HttpStatus.CONFLICT, 'CONFLICT', 'Nombre maximal de photos atteint.', [
        { path: 'file', message: 'PHOTOS_LIMIT' },
      ]);
    }

    const { large, small } = await renderVariants(file);
    const storageKey = `vehicles/${vehicle.agencyId}/${vehicle.id}/${randomUUID()}`;
    const keys = vehiclePhotoKeys(storageKey);
    await Promise.all([
      this.storage.putPublic(keys.large, large.data, 'image/webp'),
      this.storage.putPublic(keys.small, small.data, 'image/webp'),
    ]);

    try {
      const last = await this.prisma.vehiclePhoto.aggregate({
        where: { vehicleId: vehicle.id },
        _max: { position: true },
      });
      const photo = await this.prisma.vehiclePhoto.create({
        data: {
          vehicleId: vehicle.id,
          storageKey,
          position: (last._max.position ?? -1) + 1,
          width: large.width,
          height: large.height,
          sizeBytes: large.data.length + small.data.length,
        },
      });
      return toVehiclePhoto(photo, this.publicUrl);
    } catch (error) {
      await this.storage.deletePublic([keys.large, keys.small]);
      throw error;
    }
  }

  async remove(ownerId: string, vehicleId: string, photoId: string): Promise<void> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: { id: photoId, vehicleId: vehicle.id },
    });
    if (photo === null) {
      throw new NotFoundException('Photo introuvable.');
    }
    await this.prisma.vehiclePhoto.delete({ where: { id: photo.id } });
    const keys = vehiclePhotoKeys(photo.storageKey);
    await this.storage.deletePublic([keys.large, keys.small]);
  }

  /** `photoIds` doit contenir exactement les photos du véhicule, dans le nouvel ordre. */
  async reorder(ownerId: string, vehicleId: string, photoIds: string[]): Promise<VehiclePhoto[]> {
    const vehicle = await this.ownedVehicle(ownerId, vehicleId);
    const current = await this.prisma.vehiclePhoto.findMany({
      where: { vehicleId: vehicle.id },
      select: { id: true },
    });
    const known = new Set(current.map((photo) => photo.id));
    if (current.length !== photoIds.length || photoIds.some((id) => !known.has(id))) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'Les photos du véhicule ont changé entre-temps.',
      );
    }
    await this.prisma.$transaction(
      photoIds.map((id, position) =>
        this.prisma.vehiclePhoto.update({ where: { id }, data: { position } }),
      ),
    );
    const photos = await this.prisma.vehiclePhoto.findMany({
      where: { vehicleId: vehicle.id },
      ...VEHICLE_PHOTOS_INCLUDE,
    });
    return photos.map((photo) => toVehiclePhoto(photo, this.publicUrl));
  }
}
