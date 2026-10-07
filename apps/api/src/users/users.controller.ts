import {
  type ChangePasswordRequest,
  changePasswordSchema,
  type CurrentUser,
  type UpdateProfileRequest,
  updateProfileSchema,
} from '@drivetn/types';
import { Body, Controller, HttpCode, HttpStatus, Inject, Patch, Post, Req } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { readRefreshToken } from '../auth/auth.cookies';
import { ChangePasswordDto, CurrentUserDto, UpdateProfileDto } from '../auth/auth.dto';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser as CurrentUserParam } from '../common/auth/decorators';
import { getRequestContext } from '../common/http/request-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  @Patch('me')
  @ApiOperation({ summary: 'Met à jour le profil (nom, email, langue)' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: CurrentUserDto })
  updateProfile(
    @CurrentUserParam() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileRequest,
  ): Promise<CurrentUser> {
    return this.users.updateProfile(user.id, body);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ name: 'change-password', limit: 10, windowSeconds: 15 * 60 })
  @ApiOperation({ summary: 'Change le mot de passe et ferme les autres sessions' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiNoContentResponse()
  async changePassword(
    @CurrentUserParam() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.users.changePassword(
      user.id,
      body,
      readRefreshToken(request.cookies),
      getRequestContext(request, this.config.APP_DOMAIN),
    );
  }
}
