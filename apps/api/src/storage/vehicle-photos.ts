import type { VehiclePhoto } from '@drivetn/types';
import type { Prisma } from '@prisma/client';

/** Inclusion Prisma des photos d'un véhicule, dans l'ordre d'affichage. */
export const VEHICLE_PHOTOS_INCLUDE = {
  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
} satisfies Prisma.Vehicle$photosArgs;

type PhotoRow = Pick<
  Prisma.VehiclePhotoGetPayload<object>,
  'id' | 'storageKey' | 'width' | 'height'
>;

export function vehiclePhotoKeys(storageKey: string): { large: string; small: string } {
  return { large: `${storageKey}/lg.webp`, small: `${storageKey}/sm.webp` };
}

export function toVehiclePhoto(row: PhotoRow, publicUrl: (key: string) => string): VehiclePhoto {
  const keys = vehiclePhotoKeys(row.storageKey);
  return {
    id: row.id,
    url: publicUrl(keys.large),
    thumbUrl: publicUrl(keys.small),
    width: row.width,
    height: row.height,
  };
}
