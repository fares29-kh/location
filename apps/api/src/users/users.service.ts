import type { ChangePasswordRequest, CurrentUser, UpdateProfileRequest } from '@drivetn/types';
import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { toCurrentUser } from '../auth/user.mapper';
import { AppException } from '../common/errors/app.exception';
import type { RequestContext } from '../common/http/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<CurrentUser> {
    const current = await this.findActive(userId);
    if (input.email !== null) {
      const owner = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (owner !== null && owner.id !== userId) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'EMAIL_ALREADY_USED',
          'Cet email est déjà associé à un compte.',
        );
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        locale: input.locale,
        ...(input.email !== current.email ? { emailVerifiedAt: null } : {}),
      },
    });
    return toCurrentUser(user);
  }

  /** Change le mot de passe et ferme les autres sessions (la session courante est conservée). */
  async changePassword(
    userId: string,
    input: ChangePasswordRequest,
    currentRefreshToken: string | undefined,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.findActive(userId);
    const valid =
      user.passwordHash !== null &&
      (await this.passwords.verify(user.passwordHash, input.currentPassword));
    if (!valid) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_CREDENTIALS',
        'Mot de passe actuel incorrect.',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.tokens.revokeAllForUser(userId, currentRefreshToken);
    await this.audit.log({
      action: 'auth.password_changed',
      actorId: userId,
      entityType: 'user',
      entityId: userId,
      ip: context.ip,
    });
  }

  private async findActive(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    });
    if (user === null) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous.');
    }
    return user;
  }
}
