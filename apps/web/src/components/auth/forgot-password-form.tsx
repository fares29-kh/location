'use client';

import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type OtpDispatch,
  resetPasswordSchema,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { OtpInput } from '@drivetn/ui/otp-input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

import { controlProps } from './control-props';
import { displayEmail } from './otp-step';
import { PasswordInput } from './password-input';
import { ResendCode } from './resend-code';
import { applyServerIssues, useAuthMessages } from './use-auth-messages';

const linkClassName =
  'rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function isValidationError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'VALIDATION_ERROR';
}

function RequestCodeStep({ onCodeSent }: { onCodeSent: (dispatch: OtpDispatch) => void }) {
  const t = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema, undefined, { raw: true }),
    defaultValues: { email: '' },
  });

  const request = useMutation({
    mutationFn: (values: ForgotPasswordInput) => authApi.forgotPassword(values),
    onSuccess: (dispatch) => {
      onCodeSent({ ...dispatch, email: dispatch.email ?? form.getValues('email') });
    },
    onError: (error) => {
      applyServerIssues(error, form.setError, ['email']);
    },
  });

  const emailError = validationMessage(form.formState.errors.email?.message);

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          request.mutate(values);
        })(event);
      }}
    >
      {request.isError && !isValidationError(request.error) && (
        <Alert tone="danger">{errorMessage(request.error)}</Alert>
      )}
      <Field id={`${id}-email`} label={t('fields.email')} error={emailError}>
        <Input
          {...controlProps(`${id}-email`, { error: emailError })}
          type="email"
          autoComplete="email"
          dir="ltr"
          {...form.register('email')}
        />
      </Field>
      <Button type="submit" size="lg" loading={request.isPending}>
        {t('forgot.sendCode')}
      </Button>
    </form>
  );
}

const resetFormSchema = resetPasswordSchema.omit({ email: true });

function ResetStep({
  dispatch,
  onDone,
}: {
  dispatch: OtpDispatch & { email: string };
  onDone: () => void;
}) {
  const t = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(resetFormSchema, undefined, { raw: true }),
    defaultValues: { code: '', password: '' },
  });

  const reset = useMutation({
    mutationFn: (values: { code: string; password: string }) =>
      authApi.resetPassword({ ...values, email: dispatch.email }),
    onSuccess: onDone,
    onError: (error) => {
      applyServerIssues(error, form.setError, ['code', 'password']);
    },
  });

  const { errors } = form.formState;
  const codeError = validationMessage(errors.code?.message);
  const passwordError = validationMessage(errors.password?.message);
  const passwordHint = t('passwordHint');

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          reset.mutate(values);
        })(event);
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t('forgot.resetSubtitle', { email: displayEmail(dispatch.email) })}
      </p>
      {reset.isError && !isValidationError(reset.error) && (
        <Alert tone="danger">{errorMessage(reset.error)}</Alert>
      )}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t('fields.code')}</legend>
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <OtpInput
              value={field.value}
              onValueChange={field.onChange}
              invalid={codeError !== undefined}
              getInputLabel={(index, length) => t('otp.digitLabel', { index: index + 1, length })}
            />
          )}
        />
        {codeError !== undefined && (
          <p role="alert" className="text-sm font-medium text-danger">
            {codeError}
          </p>
        )}
      </fieldset>
      <ResendCode
        initialSeconds={dispatch.resendInSeconds}
        onResend={() => authApi.forgotPassword({ email: dispatch.email })}
      />
      <Field
        id={`${id}-password`}
        label={t('fields.newPassword')}
        hint={passwordHint}
        error={passwordError}
      >
        <PasswordInput
          {...controlProps(`${id}-password`, { error: passwordError, hint: passwordHint })}
          autoComplete="new-password"
          {...form.register('password')}
        />
      </Field>
      <Button type="submit" size="lg" loading={reset.isPending}>
        {t('forgot.submit')}
      </Button>
    </form>
  );
}

/** Réinitialisation du mot de passe : email, puis code reçu et nouveau mot de passe. */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [step, setStep] = useState<
    | { kind: 'request' }
    | { kind: 'reset'; dispatch: OtpDispatch & { email: string } }
    | { kind: 'done' }
  >({ kind: 'request' });

  if (step.kind === 'done') {
    return (
      <Alert
        tone="success"
        title={t('forgot.successTitle')}
        action={
          <Button asChild>
            <Link href="/login">{t('forgot.backToLogin')}</Link>
          </Button>
        }
      >
        {t('forgot.successText')}
      </Alert>
    );
  }

  return (
    <div className="grid gap-6">
      {step.kind === 'request' ? (
        <RequestCodeStep
          onCodeSent={(dispatch) => {
            if (dispatch.email === undefined) {
              return;
            }
            setStep({ kind: 'reset', dispatch: { ...dispatch, email: dispatch.email } });
          }}
        />
      ) : (
        <ResetStep
          dispatch={step.dispatch}
          onDone={() => {
            setStep({ kind: 'done' });
          }}
        />
      )}
      <p className="text-center">
        <Link href="/login" className={linkClassName}>
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </div>
  );
}
