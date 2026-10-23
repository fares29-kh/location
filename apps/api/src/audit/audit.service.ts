import type { AuditAction } from '@drivetn/types';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** Type d'élément concerné, utilisé par le journal de l'administration pour le libellé. */
export type AuditEntityType =
  | 'agency'
  | 'user'
  | 'booking'
  | 'payment'
  | 'invoice'
  | 'review'
  | 'vehicle'
  | 'expense'
  | 'refresh_token_family';

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  entityType?: AuditEntityType;
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
