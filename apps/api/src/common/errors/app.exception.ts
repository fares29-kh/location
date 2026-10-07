import type { ErrorCode } from '@drivetn/types';
import { HttpException, type HttpStatus } from '@nestjs/common';

/** Erreur métier portant un code stable que le front traduit. */
export class AppException extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string, details?: unknown) {
    super(details === undefined ? { code, message } : { code, message, details }, status);
  }
}
