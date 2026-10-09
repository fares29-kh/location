import { VEHICLE_PHOTO_MAX_BYTES, VEHICLE_PHOTOS_MAX, type VehiclePhoto } from '@drivetn/types';
import { describe, expect, it } from 'vitest';

import {
  movePhotoDraft,
  type PhotoDraft,
  photoOrderToApply,
  planPhotoChanges,
  savedPhotoDrafts,
  selectPhotoFiles,
} from './vehicle-photos';

function photo(id: string): VehiclePhoto {
  return { id, url: `/media/${id}/lg.webp`, thumbUrl: `/media/${id}/sm.webp`, width: 4, height: 3 };
}

function file(name: string, type = 'image/jpeg', size = 1000): File {
  const blob = new File(['x'], name, { type });
  Object.defineProperty(blob, 'size', { value: size });
  return blob;
}

function draft(key: string): PhotoDraft {
  return { kind: 'new', key, file: file(`${key}.jpg`), previewUrl: `blob:${key}` };
}

describe('selectPhotoFiles', () => {
  it('rejette les formats, les fichiers trop lourds et ce qui dépasse la limite', () => {
    const result = selectPhotoFiles(
      [
        file('ok.jpg'),
        file('anim.gif', 'image/gif'),
        file('big.png', 'image/png', VEHICLE_PHOTO_MAX_BYTES + 1),
        file('ok2.webp', 'image/webp'),
        file('extra.jpg'),
      ],
      VEHICLE_PHOTOS_MAX - 2,
    );
    expect(result.accepted.map((accepted) => accepted.name)).toEqual(['ok.jpg', 'ok2.webp']);
    expect(result.rejected.map(({ file: rejected, reason }) => [rejected.name, reason])).toEqual([
      ['anim.gif', 'type'],
      ['big.png', 'size'],
      ['extra.jpg', 'limit'],
    ]);
  });
});

describe('movePhotoDraft', () => {
  it('déplace sans modifier le tableau d’origine et ignore les index hors limites', () => {
    const drafts = [draft('a'), draft('b'), draft('c')];
    expect(movePhotoDraft(drafts, 2, 0).map((item) => item.key)).toEqual(['c', 'a', 'b']);
    expect(movePhotoDraft(drafts, 0, 3).map((item) => item.key)).toEqual(['a', 'b', 'c']);
    expect(drafts.map((item) => item.key)).toEqual(['a', 'b', 'c']);
  });
});

describe('planPhotoChanges / photoOrderToApply', () => {
  const p1 = photo('p1');
  const p2 = photo('p2');
  const p3 = photo('p3');
  const initial = [p1, p2, p3];

  it('liste les suppressions et les envois', () => {
    const drafts = [...savedPhotoDrafts([p3, p1]), draft('n1')];
    const plan = planPhotoChanges(initial, drafts);
    expect(plan.removedIds).toEqual(['p2']);
    expect(plan.uploads.map((upload) => upload.key)).toEqual(['n1']);
  });

  it('ne réordonne pas quand les nouvelles photos sont simplement ajoutées à la fin', () => {
    const drafts = [...savedPhotoDrafts(initial), draft('n1')];
    expect(photoOrderToApply(initial, drafts, new Map([['n1', 'p4']]))).toBeNull();
  });

  it('réordonne quand une nouvelle photo devient la couverture, en ignorant les envois échoués', () => {
    const drafts = [draft('n1'), draft('n2'), ...savedPhotoDrafts([p1, p2])];
    expect(photoOrderToApply(initial, drafts, new Map([['n1', 'p4']]))).toEqual(['p4', 'p1', 'p2']);
  });

  it('réordonne les photos existantes', () => {
    const drafts = savedPhotoDrafts([p2, p1, p3]);
    expect(photoOrderToApply(initial, drafts, new Map())).toEqual(['p2', 'p1', 'p3']);
    expect(photoOrderToApply(initial, [], new Map())).toBeNull();
  });
});
