import {
  authResultSchema,
  type ChangePasswordInput,
  currentUserSchema,
  type ForgotPasswordInput,
  type LoginInput,
  otpDispatchSchema,
  type OtpRequestInput,
  type OtpVerifyInput,
  type ResetPasswordInput,
  type SignupInput,
  type UpdateProfileInput,
} from '@drivetn/types';

import { apiFetch } from './client';

export const authApi = {
  signup: (body: SignupInput) =>
    apiFetch('/auth/signup', { method: 'POST', body, schema: otpDispatchSchema }),
  requestOtp: (body: OtpRequestInput) =>
    apiFetch('/auth/otp/request', { method: 'POST', body, schema: otpDispatchSchema }),
  verifySignup: (body: OtpVerifyInput) =>
    apiFetch('/auth/otp/verify', { method: 'POST', body, schema: authResultSchema }),
  login: (body: LoginInput) =>
    apiFetch('/auth/login', { method: 'POST', body, schema: authResultSchema }),
  loginWithOtp: (body: OtpVerifyInput) =>
    apiFetch('/auth/login/otp', { method: 'POST', body, schema: authResultSchema }),
  forgotPassword: (body: ForgotPasswordInput) =>
    apiFetch('/auth/password/forgot', { method: 'POST', body, schema: otpDispatchSchema }),
  resetPassword: (body: ResetPasswordInput) =>
    apiFetch('/auth/password/reset', { method: 'POST', body }),
  handoff: (code: string) =>
    apiFetch('/auth/handoff', { method: 'POST', body: { code }, schema: authResultSchema }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

export const usersApi = {
  updateProfile: (body: UpdateProfileInput) =>
    apiFetch('/users/me', { method: 'PATCH', body, schema: currentUserSchema }),
  changePassword: (body: ChangePasswordInput) =>
    apiFetch('/users/me/password', { method: 'POST', body }),
};
