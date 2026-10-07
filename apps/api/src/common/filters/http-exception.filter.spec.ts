import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { normalizeException } from './http-exception.filter';

describe('normalizeException', () => {
  it('masque les erreurs inattendues derrière INTERNAL_ERROR', () => {
    const result = normalizeException(new Error('secret de base de données'));
    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue.',
    });
  });

  it('associe le statut HTTP au code métier', () => {
    const result = normalizeException(new NotFoundException('Véhicule introuvable'));
    expect(result).toEqual({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Véhicule introuvable' },
    });
  });

  it('expose les messages multiples de validation dans details', () => {
    const result = normalizeException(new BadRequestException(['phone invalide', 'cin requis']));
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('VALIDATION_ERROR');
    expect(result.body.details).toEqual(['phone invalide', 'cin requis']);
  });

  it('conserve les détails fournis explicitement', () => {
    const exception = new HttpException(
      { message: 'Conflit de dates', details: { vehicleId: 'v1' } },
      HttpStatus.CONFLICT,
    );
    expect(normalizeException(exception).body).toEqual({
      code: 'CONFLICT',
      message: 'Conflit de dates',
      details: { vehicleId: 'v1' },
    });
  });

  it('accepte une réponse sous forme de chaîne', () => {
    const exception = new HttpException('Trop de requêtes', HttpStatus.TOO_MANY_REQUESTS);
    expect(normalizeException(exception).body).toEqual({
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop de requêtes',
    });
  });

  it('utilise un code générique pour un statut non répertorié', () => {
    expect(normalizeException(new HttpException('Teapot', 418)).body.code).toBe('BAD_REQUEST');
    expect(normalizeException(new HttpException('Bad gateway', 502)).body.code).toBe(
      'INTERNAL_ERROR',
    );
  });
});
