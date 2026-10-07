import { describe, expect, it } from 'vitest';

import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)/g)].map((match) => match[1] ?? '').sort();
}

function messageAt(messages: unknown, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined,
      messages,
    );
  if (typeof value !== 'string') {
    throw new Error(`Clé manquante : ${path}`);
  }
  return value;
}

const frKeys = flattenKeys(fr).sort();

describe.each([
  ['ar', ar],
  ['en', en],
] as const)('messages %s', (_locale, messages) => {
  it('a exactement les mêmes clés que le français', () => {
    expect(flattenKeys(messages).sort()).toEqual(frKeys);
  });

  it('conserve les mêmes variables d’interpolation', () => {
    for (const key of frKeys) {
      expect(placeholders(messageAt(messages, key)), key).toEqual(placeholders(messageAt(fr, key)));
    }
  });

  it('ne contient aucun message vide', () => {
    for (const key of frKeys) {
      expect(messageAt(messages, key).trim(), key).not.toBe('');
    }
  });
});
