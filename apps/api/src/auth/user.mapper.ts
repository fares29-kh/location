import { type CurrentUser, normalizeTunisianPhone } from '@drivetn/types';
import type { User } from '@prisma/client';

export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    role: user.role,
    adminRole: user.adminRole,
    status: user.status,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: normalizeTunisianPhone(user.phone),
    phoneVerified: user.phoneVerifiedAt !== null,
    email: user.email,
    locale: user.locale,
  };
}
