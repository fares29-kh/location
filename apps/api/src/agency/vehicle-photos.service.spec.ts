import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { AppException } from '../common/errors/app.exception';
import { renderVariants } from './vehicle-photos.service';

function image(width: number, height: number, format: 'jpeg' | 'png' | 'gif'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#2563eb' } })
    .toFormat(format)
    .toBuffer();
}

describe('renderVariants', () => {
  it('produit une grande taille et une vignette WebP sans agrandir', async () => {
    const { large, small } = await renderVariants(await image(3200, 2400, 'jpeg'));
    expect([large.width, large.height]).toEqual([1600, 1200]);
    expect([small.width, small.height]).toEqual([640, 480]);
    expect((await sharp(large.data).metadata()).format).toBe('webp');

    const tiny = await renderVariants(await image(400, 300, 'png'));
    expect([tiny.large.width, tiny.small.width]).toEqual([400, 400]);
  });

  it('applique l’orientation EXIF', async () => {
    const rotated = await sharp(await image(800, 400, 'jpeg'))
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const { large } = await renderVariants(rotated);
    expect([large.width, large.height]).toEqual([400, 800]);
  });

  it('refuse les fichiers qui ne sont pas des images prises en charge', async () => {
    await expect(renderVariants(Buffer.from('pas une image'))).rejects.toBeInstanceOf(AppException);
    await expect(renderVariants(await image(10, 10, 'gif'))).rejects.toBeInstanceOf(AppException);
  });
});
