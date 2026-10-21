import { LOCALES, OTP_PURPOSES } from '@drivetn/types';
import { describe, expect, it } from 'vitest';

import { renderEmailHtml, renderEmailSubject, renderMessage } from './templates';

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

  it('rend la relance de facture avec le numéro, le montant et l’échéance', () => {
    for (const locale of LOCALES) {
      for (const overdue of [false, true]) {
        const text = renderMessage(
          {
            template: 'invoice_reminder',
            channel: 'WHATSAPP',
            to: '+21671000000',
            locale,
            invoiceNumber: 'FAC-2026-0042',
            totalMillimes: 118_810,
            dueDate: '2026-10-15',
            overdue,
          },
          'DriveTN',
        );
        expect(text).toContain('FAC-2026-0042');
        expect(text).toContain('15/10/2026');
        expect(text).toContain('DriveTN');
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('distingue une facture en retard d’une échéance à venir', () => {
    const base = {
      template: 'invoice_reminder',
      channel: 'WHATSAPP',
      to: '+21671000000',
      locale: 'fr',
      invoiceNumber: 'FAC-2026-0042',
      totalMillimes: 118_810,
      dueDate: '2026-09-15',
    } as const;
    expect(renderMessage({ ...base, overdue: false }, 'DriveTN')).toContain('arrive à échéance');
    expect(renderMessage({ ...base, overdue: true }, 'DriveTN')).toContain('reste impayée');
  });

  it('met le code dans le corps de l’email et pas dans l’objet', () => {
    const job = {
      template: 'otp',
      channel: 'EMAIL',
      to: 'amira@example.tn',
      locale: 'fr',
      purpose: 'SIGNUP',
      code: '482915',
      expiresInMinutes: 10,
    } as const;
    const text = renderMessage(job, 'DriveTN');
    expect(text).toContain('482915');
    expect(text).toContain('ignorez cet email');
    expect(renderEmailSubject(job, 'DriveTN')).toBe('Votre code de vérification DriveTN');
    expect(renderEmailSubject(job, 'DriveTN')).not.toContain('482915');
  });

  it('habille le code email aux couleurs du site, sans le mettre dans l’aperçu', () => {
    const job = {
      template: 'otp',
      channel: 'EMAIL',
      to: 'amira@example.tn',
      locale: 'fr',
      purpose: 'LOGIN',
      code: '482915',
      expiresInMinutes: 10,
    } as const;
    const html = renderEmailHtml(job, 'DriveTN') ?? '';
    expect(html).toContain('#E60013');
    expect(html).toContain('Drive<span style="color:#E60013;">Tn</span>');
    expect(html).toContain('cid:drivetn-logo');
    expect(html).toContain('>4<');
    expect(html).toContain('>8<');
    expect(html).toContain('>2<');
    expect(html).toContain('>9<');
    expect(html).toContain('>1<');
    expect(html).toContain('>5<');
    expect(html).not.toMatch(/\{\w+\}/);
    const preview = html.slice(html.indexOf('display:none'), html.indexOf('</div>'));
    expect(preview).not.toContain('482915');
    expect(renderEmailHtml({ ...job, channel: 'SMS' }, 'DriveTN')).toBeUndefined();
  });

  it('écrit l’email arabe de droite à gauche', () => {
    const html =
      renderEmailHtml(
        {
          template: 'otp',
          channel: 'EMAIL',
          to: 'amira@example.tn',
          locale: 'ar',
          purpose: 'SIGNUP',
          code: '482915',
          expiresInMinutes: 10,
        },
        'DriveTN',
      ) ?? '';
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('أكّد بريدك الإلكتروني');
  });
});
