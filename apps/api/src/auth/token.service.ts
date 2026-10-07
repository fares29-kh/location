import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import type { AccessTokenPayload } from '../common/auth/authenticated-user';
import type { RequestContext } from '../common/http/request-context';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Délai pendant lequel la réutilisation d'un refresh token tout juste remplacé est
 * considérée comme une course bénigne (deux onglets, requêtes parallèles) et non un vol.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

const SESSION_EXPIRED = 'Session expirée, reconnectez-vous.';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  /** Ouvre une nouvelle session (nouvelle famille de refresh tokens). */
  async createSession(
    user: Pick<User, 'id' | 'role' | 'adminRole'>,
    context: RequestContext,
  ): Promise<SessionTokens> {
    const refreshToken = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId: randomUUID(),
        expiresAt: this.refreshExpiry(),
        userAgent: context.userAgent,
        ip: context.ip,
      },
    });
    return { accessToken: await this.signAccessToken(user), refreshToken };
  }

  /**
   * Échange un refresh token contre une nouvelle paire. Un jeton déjà remplacé et présenté
   * à nouveau (hors délai de grâce) révoque toute la famille : la session est compromise.
   */
  async rotate(
    refreshToken: string,
    context: RequestContext,
  ): Promise<SessionTokens & { userId: string }> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (current === null || current.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (current.revokedAt !== null) {
      await this.handleReuse(current, context);
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const nextToken = generateOpaqueToken();
    const rotated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.refreshToken.create({
        data: {
          userId: current.userId,
          tokenHash: hashToken(nextToken),
          familyId: current.familyId,
          expiresAt: current.expiresAt,
          userAgent: context.userAgent,
          ip: context.ip,
        },
      });
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      if (count === 0) {
        // Une rotation concurrente a gagné : on annule la création.
        throw new UnauthorizedException(SESSION_EXPIRED);
      }
      return next;
    });

    return {
      userId: rotated.userId,
      accessToken: await this.signAccessToken(current.user),
      refreshToken: nextToken,
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (token !== null) {
      await this.revokeFamily(token.familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Révoque toutes les sessions d'un utilisateur, sauf éventuellement la session courante. */
  async revokeAllForUser(userId: string, exceptRefreshToken?: string): Promise<void> {
    const keep =
      exceptRefreshToken === undefined
        ? null
        : await this.prisma.refreshToken.findUnique({
            where: { tokenHash: hashToken(exceptRefreshToken) },
            select: { familyId: true, userId: true },
          });
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keep !== null && keep.userId === userId ? { NOT: { familyId: keep.familyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  private async handleReuse(
    token: { id: string; userId: string; familyId: string; revokedAt: Date | null },
    context: RequestContext,
  ): Promise<void> {
    const revokedFor = Date.now() - (token.revokedAt?.getTime() ?? 0);
    if (revokedFor <= REFRESH_REUSE_GRACE_MS) {
      return;
    }
    await this.revokeFamily(token.familyId);
    await this.audit.log({
      action: 'auth.refresh_token_reused',
      actorId: token.userId,
      entityType: 'refresh_token_family',
      entityId: token.familyId,
      ip: context.ip,
    });
  }

  private signAccessToken(user: Pick<User, 'id' | 'role' | 'adminRole'>): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      adminRole: user.adminRole,
    };
    return this.jwt.signAsync(payload);
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }
}
