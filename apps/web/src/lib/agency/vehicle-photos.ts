import {
  VEHICLE_PHOTO_MAX_BYTES,
  VEHICLE_PHOTOS_MAX,
  type VehiclePhoto,
  isVehiclePhotoType,
} from '@drivetn/types';

/** Photo telle qu'éditée dans le formulaire : déjà enregistrée ou en attente d'envoi. */
export type PhotoDraft =
  | { kind: 'saved'; key: string; photo: VehiclePhoto }
  | { kind: 'new'; key: string; file: File; previewUrl: string };

export type PhotoRejection = 'type' | 'size' | 'limit';

export interface PhotoSelection {
  accepted: File[];
  rejected: { file: File; reason: PhotoRejection }[];
}

/** Trie les fichiers choisis : formats et poids acceptés, dans la limite des places restantes. */
export function selectPhotoFiles(files: readonly File[], currentCount: number): PhotoSelection {
  const selection: PhotoSelection = { accepted: [], rejected: [] };
  for (const file of files) {
    if (!isVehiclePhotoType(file.type)) {
      selection.rejected.push({ file, reason: 'type' });
    } else if (file.size > VEHICLE_PHOTO_MAX_BYTES) {
      selection.rejected.push({ file, reason: 'size' });
    } else if (currentCount + selection.accepted.length >= VEHICLE_PHOTOS_MAX) {
      selection.rejected.push({ file, reason: 'limit' });
    } else {
      selection.accepted.push(file);
    }
  }
  return selection;
}

export function vehicleCoverUrl(vehicle: { photos: readonly VehiclePhoto[] }): string | null {
  return vehicle.photos[0]?.thumbUrl ?? null;
}

export function savedPhotoDrafts(photos: readonly VehiclePhoto[]): PhotoDraft[] {
  return photos.map((photo) => ({ kind: 'saved', key: photo.id, photo }));
}

export function photoDraftUrl(draft: PhotoDraft): string {
  return draft.kind === 'saved' ? draft.photo.thumbUrl : draft.previewUrl;
}

export function movePhotoDraft(drafts: readonly PhotoDraft[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= drafts.length || to >= drafts.length) {
    return [...drafts];
  }
  const next = [...drafts];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) {
    next.splice(to, 0, moved);
  }
  return next;
}

export interface PhotoPlan {
  removedIds: string[];
  uploads: Extract<PhotoDraft, { kind: 'new' }>[];
}

export function planPhotoChanges(
  initial: readonly VehiclePhoto[],
  drafts: readonly PhotoDraft[],
): PhotoPlan {
  const kept = new Set(drafts.flatMap((draft) => (draft.kind === 'saved' ? [draft.photo.id] : [])));
  return {
    removedIds: initial.filter((photo) => !kept.has(photo.id)).map((photo) => photo.id),
    uploads: drafts.filter((draft) => draft.kind === 'new'),
  };
}

/**
 * Ordre à appliquer une fois les envois terminés, ou `null` si celui du serveur convient déjà
 * (photos conservées dans leur ordre, puis nouvelles photos ajoutées à la suite).
 */
export function photoOrderToApply(
  initial: readonly VehiclePhoto[],
  drafts: readonly PhotoDraft[],
  uploaded: ReadonlyMap<string, string>,
): string[] | null {
  const wanted = drafts.flatMap((draft) => {
    if (draft.kind === 'saved') {
      return [draft.photo.id];
    }
    const id = uploaded.get(draft.key);
    return id === undefined ? [] : [id];
  });
  const kept = new Set(wanted);
  const serverOrder = [
    ...initial.filter((photo) => kept.has(photo.id)).map((photo) => photo.id),
    ...drafts.flatMap((draft) => {
      const id = draft.kind === 'new' ? uploaded.get(draft.key) : undefined;
      return id === undefined ? [] : [id];
    }),
  ];
  const same =
    wanted.length === serverOrder.length && wanted.every((id, index) => id === serverOrder[index]);
  return wanted.length === 0 || same ? null : wanted;
}
