import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AppException } from '../errors/app.exception';
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

  it('conserve le code métier d’une AppException', () => {
    const exception = new AppException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Code incorrect', {
      attemptsLeft: 2,
    });
    expect(normalizeException(exception)).toEqual({
      status: 400,
      body: { code: 'OTP_INVALID', message: 'Code incorrect', details: { attemptsLeft: 2 } },
    });
  });

  it('ignore un code inconnu dans la réponse', () => {
    const exception = new HttpException({ code: 'OOPS', message: 'x' }, HttpStatus.CONFLICT);
    expect(normalizeException(exception).body.code).toBe('CONFLICT');
  });

  it('utilise un code générique pour un statut non répertorié', () => {
    expect(normalizeException(new HttpException('Teapot', 418)).body.code).toBe('BAD_REQUEST');
    expect(normalizeException(new HttpException('Bad gateway', 502)).body.code).toBe(
      'INTERNAL_ERROR',
    );
  });
});
