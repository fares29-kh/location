import { type ErrorCode, errorCodeSchema, type ErrorResponse } from '@drivetn/types';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const INTERNAL_ERROR_MESSAGE = 'Une erreur interne est survenue.';

interface NormalizedError {
  status: number;
  body: ErrorResponse;
}

export function normalizeException(exception: unknown): NormalizedError {
  if (!(exception instanceof HttpException)) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: INTERNAL_ERROR_MESSAGE },
    };
  }

  const status = exception.getStatus();
  const code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const payload = exception.getResponse();

  if (typeof payload === 'string') {
    return { status, body: { code, message: payload } };
  }

  const {
    message,
    details,
    code: payloadCode,
  } = payload as { message?: unknown; details?: unknown; code?: unknown };
  // Les messages multiples (validation) sont exposés dans `details`.
  if (Array.isArray(message)) {
    return {
      status,
      body: { code: 'VALIDATION_ERROR', message: exception.message, details: message },
    };
  }

  const parsedCode = errorCodeSchema.safeParse(payloadCode);
  const finalCode = parsedCode.success ? parsedCode.data : code;
  const text = typeof message === 'string' && message.length > 0 ? message : exception.message;
  return {
    status,
    body:
      details === undefined
        ? { code: finalCode, message: text }
        : { code: finalCode, message: text, details },
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = normalizeException(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    response.status(status).json(body);
  }
}
