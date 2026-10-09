import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { normalizeException } from '../filters/http-exception.filter';
import { CONSTRAINT_MESSAGES, findConstraintViolation } from './constraint-violation';

const clientVersion = Prisma.prismaVersion.client;

/** Forme renvoyée par le client Prisma (create, update...). */
function clientError(code: string, message: string): Prisma.PrismaClientUnknownRequestError {
  return new Prisma.PrismaClientUnknownRequestError(
    `Invalid \`prisma.booking.create()\` invocation:\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "${code}", message: ${JSON.stringify(message)}, severity: "ERROR", detail: Some("Failing row contains (b1, +21620123456, Hédi)."), column: None, hint: None }), transient: false })`,
    { clientVersion },
  );
}

/** Forme renvoyée par `$executeRaw` / `$queryRaw` (P2010). */
function rawError(code: string, message: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Raw query failed. Code: \`${code}\`. Message: \`ERROR: ${message}\``,
    { code: 'P2010', clientVersion, meta: { code, message: `ERROR: ${message}` } },
  );
}

describe('violations de contraintes', () => {
  it('chevauchement (23P01) : 409 VEHICLE_UNAVAILABLE', () => {
    const message =
      'conflicting key value violates exclusion constraint "bookings_vehicle_no_overlap"';
    for (const error of [clientError('23P01', message), rawError('23P01', message)]) {
      expect(normalizeException(error)).toEqual({
        status: 409,
        body: {
          code: 'VEHICLE_UNAVAILABLE',
          message: 'Ce véhicule n’est plus disponible sur ces dates.',
          details: { constraint: 'bookings_vehicle_no_overlap' },
        },
      });
    }
  });

  it('CHECK (23514) : 409 avec le message de la contrainte, sans le détail PostgreSQL', () => {
    const message =
      'new row for relation "reviews" violates check constraint "reviews_rating_check"';
    for (const error of [clientError('23514', message), rawError('23514', message)]) {
      const { status, body } = normalizeException(error);
      expect(status).toBe(409);
      expect(body).toEqual({
        code: 'CONFLICT',
        message: 'La note d’un avis doit être comprise entre 1 et 5.',
        details: { constraint: 'reviews_rating_check' },
      });
      expect(JSON.stringify(body)).not.toContain('Hédi');
    }
  });

  it('reconnaît la contrainte quand le serveur répond en français', () => {
    const error = clientError(
      '23514',
      'la nouvelle ligne de la relation « bookings » viole la contrainte de vérification « bookings_return_after_pickup_check »',
    );
    expect(findConstraintViolation(error)).toEqual({
      sqlState: '23514',
      constraint: 'bookings_return_after_pickup_check',
    });
  });

  it('ignore l’extrait de code source cité par Prisma', () => {
    const error = new Prisma.PrismaClientUnknownRequestError(
      `Invalid \`prisma.invoice.create()\` invocation in\ntest.ts:12:5\n\n  11 expectRefused(payment(0), 'payments_amount_positive_check');\n→ 12 ctx.prisma.invoice.create(\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23514", message: "new row for relation \\"invoices\\" violates check constraint \\"invoices_total_check\\"", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })`,
      { clientVersion },
    );
    expect(findConstraintViolation(error)).toEqual({
      sqlState: '23514',
      constraint: 'invoices_total_check',
    });
  });

  it('ne confond pas deux contraintes au nom proche', () => {
    const error = rawError(
      '23514',
      'new row for relation "vehicles" violates check constraint "vehicles_daily_rate_positive_check"',
    );
    expect(findConstraintViolation(error)?.constraint).toBe('vehicles_daily_rate_positive_check');
  });

  it('contrainte inconnue : 409 générique, jamais 500', () => {
    expect(
      normalizeException(rawError('23514', 'violates check constraint "autre_check"')),
    ).toEqual({
      status: 409,
      body: {
        code: 'CONFLICT',
        message: 'Les données envoyées ne respectent pas les règles d’intégrité.',
      },
    });
  });

  it('ignore les autres erreurs', () => {
    expect(findConstraintViolation(new Error('23514'))).toBeNull();
    expect(
      findConstraintViolation(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion,
          meta: { target: ['reference'] },
        }),
      ),
    ).toBeNull();
    expect(normalizeException(clientError('23505', 'duplicate key')).status).toBe(500);
  });

  it('associe chaque contrainte de la migration à un message', () => {
    const migration = readFileSync(
      join(
        __dirname,
        '../../../prisma/migrations/20261008060000_integrity_constraints/migration.sql',
      ),
      'utf8',
    );
    const created = [...migration.matchAll(/ADD CONSTRAINT "([a-z0-9_]+)"/g)].map(
      (match) => match[1],
    );
    expect(created).toHaveLength(20);
    expect(Object.keys(CONSTRAINT_MESSAGES).sort()).toEqual(created.sort());
  });
});
