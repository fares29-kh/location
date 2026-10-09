import { describe, expect, it } from 'vitest';

import { bookingSearchSql, customerSearchSql } from './agency.queries';

describe('recherche de l’espace agence', () => {
  it('ne produit aucune condition pour une recherche vide', () => {
    expect(bookingSearchSql('agency', '   ').sql).toBe('');
    expect(customerSearchSql('').sql).toBe('');
  });

  it('transmet chaque mot en paramètre, avec `%`, `_` et `\\` échappés', () => {
    const query = bookingSearchSql('agency', '50%_\\');
    expect(query.values).toContain('%50\\%\\_\\\\%');
    expect(query.values).toContain('agency');
    expect(query.sql).not.toContain('50');
    expect(customerSearchSql("o'brien").values).toContain("%o'brien%");
  });

  it('compare les immatriculations sans espaces ni tirets', () => {
    const query = bookingSearchSql('agency', '123-TU-4567');
    expect(query.values).toContain('%123-TU-4567%');
    expect(query.values).toContain('%123TU4567%');
  });

  it('ne cherche dans les téléphones qu’à partir de trois chiffres', () => {
    expect(bookingSearchSql('agency', 'a12').values).not.toContain('%12%');
    expect(bookingSearchSql('agency', 'tel:98-123').values).toContain('%98123%');
  });
});
