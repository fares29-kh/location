import {
  type AuthResult,
  type CurrentUser,
  forgotPasswordSchema,
  type ForgotPasswordRequest,
  handoffSchema,
  type HandoffRequest,
  loginSchema,
  type LoginRequest,
  type OtpDispatch,
  type OtpRequest,
  otpRequestSchema,
  otpVerifySchema,
  type OtpVerifyRequest,
  resetPasswordSchema,
  type ResetPasswordRequest,
  signupSchema,
  type SignupRequest,
} from '@drivetn/types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser as CurrentUserParam, Public } from '../common/auth/decorators';
import { getRequestContext, type RequestContext } from '../common/http/request-context';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { APP_CONFIG } from '../config/config.constants';
import type { Env } from '../config/env';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { clearSessionCookies, readRefreshToken, setSessionCookies } from './auth.cookies';
import {
  AuthResultDto,
  CurrentUserDto,
  ForgotPasswordDto,
  HandoffDto,
  LoginDto,
  OtpDispatchDto,
  OtpRequestDto,
  OtpVerifyDto,
  ResetPasswordDto,
  SignupDto,
} from './auth.dto';
import { AuthService, type LoginOutcome } from './auth.service';

const OTP_ROUTE_LIMIT = { limit: 10, windowSeconds: 15 * 60 } as const;
const LOGIN_ROUTE_LIMIT = { limit: 30, windowSeconds: 15 * 60 } as const;

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: Env,
  ) {}

  @Public()
  @Post('signup')
  @RateLimit({ name: 'signup', limit: 10, windowSeconds: 60 * 60 })
  @ApiOperation({ summary: 'Inscription (client ou gérant d’agence selon le portail) + envoi OTP' })
  @ApiBody({ type: SignupDto })
  @ApiCreatedResponse({ type: OtpDispatchDto })
  signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupRequest,
    @Req() request: Request,
  ): Promise<OtpDispatch> {
    return this.auth.signup(body, this.context(request));
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ name: 'otp', ...OTP_ROUTE_LIMIT })
  @ApiOperation({ summary: 'Renvoi du code d’inscription ou code de connexion sans mot de passe' })
  @ApiBody({ type: OtpRequestDto })
  @ApiAcceptedResponse({ type: OtpDispatchDto })
  requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequest,
    @Req() request: Request,
  ): Promise<OtpDispatch> {
    return this.auth.requestOtp(body, this.context(request));
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'otp-verify', limit: 30, windowSeconds: 15 * 60 })
  @ApiOperation({ summary: 'Vérifie le téléphone après inscription et ouvre la session' })
  @ApiBody({ type: OtpVerifyDto })
  @ApiOkResponse({ type: AuthResultDto })
  async verifySignup(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifyRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResult> {
    return this.respond(await this.auth.verifySignup(body, this.context(request)), response);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'login', ...LOGIN_ROUTE_LIMIT })
  @ApiOperation({ summary: 'Connexion par téléphone ou email et mot de passe' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResultDto })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResult> {
    return this.respond(await this.auth.loginWithPassword(body, this.context(request)), response);
  }

  @Public()
  @Post('login/otp')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'login', ...LOGIN_ROUTE_LIMIT })
  @ApiOperation({ summary: 'Connexion par code SMS / WhatsApp' })
  @ApiBody({ type: OtpVerifyDto })
  @ApiOkResponse({ type: AuthResultDto })
  async loginWithOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerifyRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResult> {
    return this.respond(await this.auth.loginWithOtp(body, this.context(request)), response);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ name: 'otp', ...OTP_ROUTE_LIMIT })
  @ApiOperation({ summary: 'Envoie un code de réinitialisation du mot de passe' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiAcceptedResponse({ type: OtpDispatchDto })
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordRequest,
    @Req() request: Request,
  ): Promise<OtpDispatch> {
    return this.auth.forgotPassword(body, this.context(request));
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ name: 'otp-verify', limit: 30, windowSeconds: 15 * 60 })
  @ApiOperation({ summary: 'Définit un nouveau mot de passe et ferme toutes les sessions' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiNoContentResponse()
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.resetPassword(body, this.context(request));
  }

  @Public()
  @Post('handoff')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ name: 'handoff', limit: 30, windowSeconds: 15 * 60 })
  @ApiOperation({ summary: 'Ouvre la session sur le portail du rôle (après connexion ailleurs)' })
  @ApiBody({ type: HandoffDto })
  @ApiOkResponse({ type: AuthResultDto })
  async handoff(
    @Body(new ZodValidationPipe(handoffSchema)) body: HandoffRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResult> {
    return this.respond(await this.auth.handoff(body.code, this.context(request)), response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouvelle la session (rotation du refresh token en cookie)' })
  @ApiOkResponse({ type: CurrentUserDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUser> {
    const refreshToken = readRefreshToken(request.cookies);
    try {
      if (refreshToken === undefined) {
        throw new UnauthorizedException('Session absente.');
      }
      const { user, tokens } = await this.auth.refresh(refreshToken, this.context(request));
      setSessionCookies(response, tokens, this.config);
      return user;
    } catch (error) {
      clearSessionCookies(response, this.config);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ferme la session courante' })
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(
      readRefreshToken(request.cookies),
      request.user?.id ?? null,
      this.context(request),
    );
    clearSessionCookies(response, this.config);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Utilisateur connecté' })
  @ApiOkResponse({ type: CurrentUserDto })
  me(@CurrentUserParam() user: AuthenticatedUser): Promise<CurrentUser> {
    return this.auth.me(user.id);
  }

  private context(request: Request): RequestContext {
    return getRequestContext(request, this.config.APP_DOMAIN);
  }

  private respond(outcome: LoginOutcome, response: Response): AuthResult {
    if (outcome.status === 'redirect') {
      return outcome;
    }
    setSessionCookies(response, outcome.tokens, this.config);
    return { status: 'authenticated', user: outcome.user };
  }
}
