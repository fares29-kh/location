import { Module } from '@nestjs/common';

import { MessagingModule } from '../messaging/messaging.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { RecaptchaService } from './recaptcha.service';
import { TokenService } from './token.service';

@Module({
  imports: [MessagingModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, PasswordService, RecaptchaService, TokenService],
  exports: [PasswordService, TokenService],
})
export class AuthModule {}
