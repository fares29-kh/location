'use client';

import { type SignupInput, signupSchema } from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { PhoneInput } from '@drivetn/ui/phone-input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

import { controlProps } from './control-props';
import { PasswordInput } from './password-input';
import { type PendingVerification, PhoneVerification } from './phone-verification';
import { applyServerIssues, useAuthMessages } from './use-auth-messages';
import { useCompleteAuth } from './use-complete-auth';

const SIGNUP_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'password'] as const;

/** Inscription (client ou gérant d'agence selon le formulaire), puis confirmation de l'email. */
export function SignupForm({
  portal,
  nextPath,
}: {
  portal: 'client' | 'agency';
  nextPath: string | null;
}) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const { validationMessage, errorMessage } = useAuthMessages();
  const { complete, redirecting } = useCompleteAuth(nextPath);
  const id = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [verification, setVerification] = useState<PendingVerification | null>(null);

  const form = useForm({
    resolver: zodResolver(signupSchema, undefined, { raw: true }),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      password: '',
    },
  });

  const signup = useMutation({
    mutationFn: (values: SignupInput) => authApi.signup({ ...values, locale, portal }),
    onMutate: () => {
      setFormError(null);
    },
    onSuccess: (dispatch) => {
      if (dispatch.email === undefined) {
        setFormError(t('errors.generic'));
        return;
      }
      setVerification({ flow: 'signup', dispatch: { ...dispatch, email: dispatch.email } });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PHONE_ALREADY_USED') {
        form.setError('phone', { type: 'server', message: error.code });
      } else if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_USED') {
        form.setError('email', { type: 'server', message: error.code });
      } else if (!applyServerIssues(error, form.setError, SIGNUP_FIELDS)) {
        setFormError(errorMessage(error));
      }
    },
  });

  if (verification !== null) {
    return (
      <PhoneVerification
        verification={verification}
        redirecting={redirecting}
        onAuthenticated={complete}
        onBack={() => {
          setVerification(null);
        }}
      />
    );
  }

  const { errors } = form.formState;
  const firstNameError = validationMessage(errors.firstName?.message);
  const lastNameError = validationMessage(errors.lastName?.message);
  const phoneError = validationMessage(errors.phone?.message);
  const emailError = validationMessage(errors.email?.message);
  const passwordError = validationMessage(errors.password?.message);
  const passwordHint = t('passwordHint');
  const emailHint = t('signup.emailHint');
  const phoneHint = t('signup.phoneHint');

  return (
    <div className="grid gap-6">
      {portal === 'client' && (
        <Alert title={t('clientAccount.title')}>{t('clientAccount.text')}</Alert>
      )}
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            signup.mutate(values);
          })(event);
        }}
      >
        {formError !== null && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-firstName`} label={t('fields.firstName')} error={firstNameError}>
            <Input
              {...controlProps(`${id}-firstName`, { error: firstNameError })}
              autoComplete="given-name"
              {...form.register('firstName')}
            />
          </Field>
          <Field id={`${id}-lastName`} label={t('fields.lastName')} error={lastNameError}>
            <Input
              {...controlProps(`${id}-lastName`, { error: lastNameError })}
              autoComplete="family-name"
              {...form.register('lastName')}
            />
          </Field>
        </div>
        <Field id={`${id}-email`} label={t('fields.email')} hint={emailHint} error={emailError}>
          <Input
            {...controlProps(`${id}-email`, { error: emailError, hint: emailHint })}
            type="email"
            autoComplete="email"
            dir="ltr"
            {...form.register('email')}
          />
        </Field>
        <Field id={`${id}-phone`} label={t('fields.phone')} hint={phoneHint} error={phoneError}>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                {...controlProps(`${id}-phone`, { error: phoneError, hint: phoneHint })}
                ref={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
        <Field
          id={`${id}-password`}
          label={t('fields.password')}
          hint={passwordHint}
          error={passwordError}
        >
          <PasswordInput
            {...controlProps(`${id}-password`, { error: passwordError, hint: passwordHint })}
            autoComplete="new-password"
            {...form.register('password')}
          />
        </Field>
        <p className="text-xs text-muted-foreground">{t('signup.terms')}</p>
        <Button type="submit" size="lg" loading={signup.isPending}>
          {t('signup.submit')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('signup.hasAccount')}{' '}
        <Link
          href={nextPath === null ? '/login' : { pathname: '/login', query: { next: nextPath } }}
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('signup.loginLink')}
        </Link>
      </p>
    </div>
  );
}
