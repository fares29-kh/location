import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export const AUDIT_ACTIONS = [
  'auth.signup',
  'auth.phone_verified',
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.password_reset',
  'auth.password_changed',
  'auth.refresh_token_reused',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
  ip?: string | null;
}

/** Écrit dans le journal d'audit immuable (la base refuse toute modification). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          ip: entry.ip ?? null,
        },
      });
    } catch (error) {
      // L'audit ne doit jamais bloquer l'action auditée, mais l'échec doit être visible.
      this.logger.error(
        `Échec d'écriture de l'audit "${entry.action}" : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
