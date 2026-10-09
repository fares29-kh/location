import { describe, expect, it } from 'vitest';

import { pageWindow, toPaginated } from './pagination';

describe('pageWindow', () => {
  it('calcule le décalage de la page demandée', () => {
    expect(pageWindow(95, 3, 20)).toEqual({
      page: 3,
      pageSize: 20,
      pageCount: 5,
      skip: 40,
      take: 20,
    });
  });

  it('ramène une page hors limites sur la dernière page, et une page < 1 sur la première', () => {
    expect(pageWindow(95, 42, 20)).toMatchObject({ page: 5, skip: 80 });
    expect(pageWindow(95, 0, 20)).toMatchObject({ page: 1, skip: 0 });
  });

  it('garde une page unique et vide quand il n’y a aucun élément', () => {
    expect(pageWindow(0, 7, 20)).toMatchObject({ page: 1, pageCount: 1, skip: 0 });
    expect(toPaginated([], 0, pageWindow(0, 1, 20))).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      pageCount: 1,
    });
  });
});
