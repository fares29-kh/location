'use client';

import {
  type AuthResult,
  loginSchema,
  type OtpDispatch,
  otpRequestSchema,
  type Portal,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { PhoneInput } from '@drivetn/ui/phone-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, MessageSquareText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

import { ChannelPicker } from './channel-picker';
import { controlProps } from './control-props';
import { type DemoCredentials, DemoAccounts } from './demo-accounts';
import { PasswordInput } from './password-input';
import { type PendingVerification, PhoneVerification } from './phone-verification';
import { applyServerIssues, useAuthMessages } from './use-auth-messages';
import { useCompleteAuth } from './use-complete-auth';

type PasswordLoginOutcome =
  { kind: 'authenticated'; result: AuthResult } | { kind: 'verify'; dispatch: OtpDispatch };

interface PasswordCredentials {
  identifier: string;
  password: string;
}

function PasswordLogin({
  initialValues,
  redirecting,
  onAuthenticated,
  onVerificationRequired,
}: {
  initialValues: PasswordCredentials;
  redirecting: boolean;
  onAuthenticated: (result: AuthResult) => void;
  onVerificationRequired: (verification: PendingVerification) => void;
}) {
  const t = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const id = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(loginSchema, undefined, { raw: true }),
    defaultValues: initialValues,
  });

  const login = useMutation({
    mutationFn: async (values: PasswordCredentials) => {
      try {
        const result = await authApi.login(values);
        return { kind: 'authenticated', result } satisfies PasswordLoginOutcome;
      } catch (error) {
        const phone =
          error instanceof ApiError && error.code === 'PHONE_NOT_VERIFIED'
            ? error.detailString('phone')
            : undefined;
        if (phone === undefined) {
          throw error;
        }
        const dispatch = await authApi.requestOtp({ phone, purpose: 'SIGNUP', channel: 'SMS' });
        return { kind: 'verify', dispatch } satisfies PasswordLoginOutcome;
      }
    },
    onMutate: () => {
      setFormError(null);
    },
    onSuccess: (outcome: PasswordLoginOutcome) => {
      if (outcome.kind === 'authenticated') {
        onAuthenticated(outcome.result);
      } else {
        onVerificationRequired({ flow: 'signup', channel: 'SMS', dispatch: outcome.dispatch });
      }
    },
    onError: (error) => {
      if (!applyServerIssues(error, form.setError, ['identifier', 'password'])) {
        setFormError(errorMessage(error));
      }
    },
  });

  const { errors } = form.formState;
  const identifierError = validationMessage(errors.identifier?.message);
  const passwordError = validationMessage(errors.password?.message);

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          login.mutate(values);
        })(event);
      }}
    >
      {formError !== null && <Alert tone="danger">{formError}</Alert>}
      <Field id={`${id}-identifier`} label={t('fields.identifier')} error={identifierError}>
        <Input
          {...controlProps(`${id}-identifier`, { error: identifierError })}
          autoComplete="username"
          placeholder={t('fields.identifierPlaceholder')}
          dir="ltr"
          {...form.register('identifier')}
        />
      </Field>
      <Field id={`${id}-password`} label={t('fields.password')} error={passwordError}>
        <PasswordInput
          {...controlProps(`${id}-password`, { error: passwordError })}
          autoComplete="current-password"
          {...form.register('password')}
        />
      </Field>
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('login.forgotPassword')}
        </Link>
      </div>
      <Button type="submit" size="lg" loading={login.isPending || redirecting}>
        {t('login.submit')}
      </Button>
    </form>
  );
}

const otpLoginSchema = otpRequestSchema.omit({ purpose: true });

function OtpLogin({ onCodeSent }: { onCodeSent: (verification: PendingVerification) => void }) {
  const t = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const id = useId();
  const form = useForm({
    resolver: zodResolver(otpLoginSchema, undefined, { raw: true }),
    defaultValues: { phone: '', channel: 'SMS' as const },
  });

  const request = useMutation({
    mutationFn: authApi.requestOtp,
    onSuccess: (dispatch, variables) => {
      onCodeSent({ flow: 'login', channel: variables.channel ?? 'SMS', dispatch });
    },
    onError: (error) => {
      applyServerIssues(error, form.setError, ['phone']);
    },
  });

  const phoneError = validationMessage(form.formState.errors.phone?.message);
  const requestError =
    request.isError &&
    !(request.error instanceof ApiError && request.error.code === 'VALIDATION_ERROR')
      ? errorMessage(request.error)
      : null;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          request.mutate({ ...values, purpose: 'LOGIN' });
        })(event);
      }}
    >
      <p className="text-sm text-muted-foreground">{t('login.otpHint')}</p>
      {requestError !== null && <Alert tone="danger">{requestError}</Alert>}
      <Field id={`${id}-phone`} label={t('fields.phone')} error={phoneError}>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              {...controlProps(`${id}-phone`, { error: phoneError })}
              ref={field.ref}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </Field>
      <Controller
        control={form.control}
        name="channel"
        render={({ field }) => (
          <ChannelPicker value={field.value ?? 'SMS'} onValueChange={field.onChange} />
        )}
      />
      <Button type="submit" size="lg" loading={request.isPending}>
        {t('login.sendCode')}
      </Button>
    </form>
  );
}

/** Connexion par mot de passe ou par code à usage unique, puis vérification du téléphone si besoin. */
export function LoginForm({
  portal,
  nextPath,
  demo = null,
}: {
  portal: Portal;
  nextPath: string | null;
  demo?: DemoCredentials | null;
}) {
  const t = useTranslations('auth');
  const { complete, redirecting } = useCompleteAuth(nextPath);
  const [method, setMethod] = useState('password');
  const [verification, setVerification] = useState<PendingVerification | null>(null);
  const [prefill, setPrefill] = useState({
    version: 0,
    values: { identifier: '', password: '' } satisfies PasswordCredentials,
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

  return (
    <div className="grid gap-6">
      <Tabs value={method} onValueChange={setMethod}>
        <TabsList className="grid w-full grid-cols-2" aria-label={t('login.methodsLabel')}>
          <TabsTrigger value="password">
            <KeyRound className="size-4" aria-hidden="true" />
            {t('login.methodPassword')}
          </TabsTrigger>
          <TabsTrigger value="otp">
            <MessageSquareText className="size-4" aria-hidden="true" />
            {t('login.methodOtp')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-6">
          <PasswordLogin
            key={prefill.version}
            initialValues={prefill.values}
            redirecting={redirecting}
            onAuthenticated={complete}
            onVerificationRequired={setVerification}
          />
        </TabsContent>
        <TabsContent value="otp" className="mt-6">
          <OtpLogin onCodeSent={setVerification} />
        </TabsContent>
      </Tabs>

      {portal !== 'admin' && (
        <p className="text-center text-sm text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link
            href="/signup"
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('login.signupLink')}
          </Link>
        </p>
      )}

      {demo !== null && demo.accounts.length > 0 && (
        <DemoAccounts
          demo={demo}
          onUse={(account) => {
            setMethod('password');
            setPrefill((current) => ({
              version: current.version + 1,
              values: { identifier: account.email, password: demo.password },
            }));
          }}
        />
      )}
    </div>
  );
}
