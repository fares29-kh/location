'use client';

import {
  type ChangePasswordInput,
  changePasswordSchema,
  type CurrentUser,
  getDirection,
  isLocale,
  LOCALES,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@drivetn/ui/card';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { BadgeCheck, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { controlProps } from '@/components/auth/control-props';
import { displayPhone } from '@/components/auth/otp-step';
import { PasswordInput } from '@/components/auth/password-input';
import { applyServerIssues, useAuthMessages } from '@/components/auth/use-auth-messages';
import { useLogout } from '@/components/auth/use-logout';
import { LOCALE_NAMES } from '@/i18n/locale-names';
import { useRouter } from '@/i18n/navigation';
import { usersApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

const PROFILE_FIELDS = ['firstName', 'lastName', 'email', 'locale'] as const;

function isValidationError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'VALIDATION_ERROR';
}

function ProfileCard({ user }: { user: CurrentUser }) {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const router = useRouter();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(updateProfileSchema, undefined, { raw: true }),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? '',
      locale: user.locale,
    },
  });

  const update = useMutation({
    mutationFn: (values: UpdateProfileInput) => usersApi.updateProfile(values),
    onSuccess: (updated) => {
      form.reset({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email ?? '',
        locale: updated.locale,
      });
      toast.success(t('profile.saved'));
      router.refresh();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_USED') {
        form.setError('email', { type: 'server', message: error.code });
      } else {
        applyServerIssues(error, form.setError, PROFILE_FIELDS);
      }
    },
  });

  const { errors, isDirty } = form.formState;
  const firstNameError = validationMessage(errors.firstName?.message);
  const lastNameError = validationMessage(errors.lastName?.message);
  const emailError = validationMessage(errors.email?.message);
  const showRequestError =
    update.isError &&
    !isValidationError(update.error) &&
    !(update.error instanceof ApiError && update.error.code === 'EMAIL_ALREADY_USED');

  return (
    <Card>
      <form
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            update.mutate(values);
          })(event);
        }}
      >
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showRequestError && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-firstName`} label={tAuth('fields.firstName')} error={firstNameError}>
              <Input
                {...controlProps(`${id}-firstName`, { error: firstNameError })}
                autoComplete="given-name"
                {...form.register('firstName')}
              />
            </Field>
            <Field id={`${id}-lastName`} label={tAuth('fields.lastName')} error={lastNameError}>
              <Input
                {...controlProps(`${id}-lastName`, { error: lastNameError })}
                autoComplete="family-name"
                {...form.register('lastName')}
              />
            </Field>
          </div>
          <Field id={`${id}-phone`} label={tAuth('fields.phone')} hint={t('phone.hint')}>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                {...controlProps(`${id}-phone`, { hint: t('phone.hint') })}
                value={displayPhone(user.phone)}
                readOnly
                dir="ltr"
                className="max-w-xs bg-surface-muted"
              />
              {user.phoneVerified && (
                <Badge tone="success">
                  <BadgeCheck aria-hidden="true" />
                  {t('phone.verified')}
                </Badge>
              )}
            </div>
          </Field>
          <Field id={`${id}-email`} label={tAuth('fields.emailOptional')} error={emailError}>
            <Input
              {...controlProps(`${id}-email`, { error: emailError })}
              type="email"
              autoComplete="email"
              dir="ltr"
              {...form.register('email')}
            />
          </Field>
          <Field id={`${id}-locale`} label={t('profile.language')}>
            <Controller
              control={form.control}
              name="locale"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (isLocale(value)) {
                      field.onChange(value);
                    }
                  }}
                >
                  <SelectTrigger id={`${id}-locale`} className="max-w-xs" onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        lang={option}
                        dir={getDirection(option)}
                      >
                        {LOCALE_NAMES[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!isDirty} loading={update.isPending}>
            {t('profile.save')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const t = useTranslations('account');
  const tAuth = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(changePasswordSchema, undefined, { raw: true }),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const change = useMutation({
    mutationFn: (values: ChangePasswordInput) => usersApi.changePassword(values),
    onSuccess: () => {
      form.reset();
      toast.success(t('security.success'));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        form.setError('currentPassword', { type: 'server', message: error.code });
      } else {
        applyServerIssues(error, form.setError, ['currentPassword', 'newPassword']);
      }
    },
  });

  const { errors } = form.formState;
  const currentError = validationMessage(errors.currentPassword?.message);
  const newError = validationMessage(errors.newPassword?.message);
  const passwordHint = tAuth('passwordHint');
  const showRequestError =
    change.isError &&
    !isValidationError(change.error) &&
    !(change.error instanceof ApiError && change.error.code === 'INVALID_CREDENTIALS');

  return (
    <Card>
      <form
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            change.mutate(values);
          })(event);
        }}
      >
        <CardHeader>
          <CardTitle>{t('security.title')}</CardTitle>
          <CardDescription>{t('security.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showRequestError && <Alert tone="danger">{errorMessage(change.error)}</Alert>}
          <Field id={`${id}-current`} label={tAuth('fields.currentPassword')} error={currentError}>
            <PasswordInput
              {...controlProps(`${id}-current`, { error: currentError })}
              autoComplete="current-password"
              {...form.register('currentPassword')}
            />
          </Field>
          <Field
            id={`${id}-new`}
            label={tAuth('fields.newPassword')}
            hint={passwordHint}
            error={newError}
          >
            <PasswordInput
              {...controlProps(`${id}-new`, { error: newError, hint: passwordHint })}
              autoComplete="new-password"
              {...form.register('newPassword')}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={change.isPending}>
            {t('security.submit')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SessionCard() {
  const t = useTranslations('account.session');
  const logout = useLogout('client');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          variant="secondary"
          loading={logout.isPending}
          onClick={() => {
            logout.mutate();
          }}
        >
          {!logout.isPending && <LogOut aria-hidden="true" />}
          {t('logout')}
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Espace personnel du client : profil, mot de passe, déconnexion. */
export function AccountView({ user }: { user: CurrentUser }) {
  return (
    <div className="grid gap-6">
      <ProfileCard user={user} />
      <PasswordCard />
      <SessionCard />
    </div>
  );
}
