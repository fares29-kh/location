import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { AppException } from '../errors/app.exception';

export interface ValidationIssue {
  path: string;
  /** Code stable (ex. `INVALID_TUNISIAN_PHONE`), traduit par le front. */
  message: string;
}

/** Valide et transforme une entrée avec un schéma Zod partagé (`@drivetn/types`). */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      }));
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Données invalides.',
        issues,
      );
    }
    return result.data;
  }
}
