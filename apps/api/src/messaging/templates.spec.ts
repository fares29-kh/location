import { LOCALES, OTP_PURPOSES } from '@drivetn/types';
import { describe, expect, it } from 'vitest';

import { renderMessage } from './templates';

describe('renderMessage', () => {
  it('rend un message complet dans chaque langue et pour chaque usage', () => {
    for (const locale of LOCALES) {
      for (const purpose of OTP_PURPOSES) {
        const text = renderMessage(
          {
            template: 'otp',
            channel: 'SMS',
            to: '+21698123456',
            locale,
            purpose,
            code: '482915',
            expiresInMinutes: 5,
          },
          'DriveTN',
        );
        expect(text).toContain('482915');
        expect(text).toContain('DriveTN');
        expect(text).toContain('5');
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
