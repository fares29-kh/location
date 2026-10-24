'use client';

import {
  type AuthResult,
  loginOtpRequestSchema,
  loginSchema,
  type OtpDispatch,
  type Portal,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Button } from '@drivetn/ui/button';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Link } from '@/i18n/navigation';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

import { controlProps } from './control-props';
import { useLoginCaptcha } from './recaptcha-field';
import { type DemoCredentials, DemoAccounts } from './demo-accounts';
import { PasswordInput } from './password-input';
import { type PendingVerification, PhoneVerification } from './phone-verification';
import { applyServerIssues, useAuthMessages } from './use-auth-messages';
import { useCompleteAuth } from './use-complete-auth';

type PasswordLoginOutcome =
  | { kind: 'authenticated'; result: AuthResult }
  | { kind: 'verify'; dispatch: OtpDispatch & { email: string } };

interface PasswordCredentials {
  identifier: string;
  password: string;
}

function PasswordLogin({
  siteKey,
  initialValues,
  redirecting,
  onAuthenticated,
  onVerificationRequired,
}: {
  siteKey: string;
  initialValues: PasswordCredentials;
  redirecting: boolean;
  onAuthenticated: (result: AuthResult) => void;
  onVerificationRequired: (verification: PendingVerification) => void;
}) {
  const t = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const captcha = useLoginCaptcha(siteKey);
  const id = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(loginSchema, undefined, { raw: true }),
    defaultValues: initialValues,
  });

  const login = useMutation({
    mutationFn: async (values: PasswordCredentials) => {
      const captchaToken = captcha.consume();
      if (captchaToken === null) {
        throw new Error('captcha');
      }
      try {
        const result = await authApi.login({
          ...values,
          ...(captchaToken === '' ? {} : { captchaToken }),
        });
        return { kind: 'authenticated', result } satisfies PasswordLoginOutcome;
      } catch (error) {
        const email =
          error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED'
            ? error.detailString('email')
            : undefined;
        if (email === undefined) {
          throw error;
        }
        const dispatch = await authApi.requestOtp({ email, purpose: 'SIGNUP' });
        return {
          kind: 'verify',
          dispatch: { ...dispatch, email },
        } satisfies PasswordLoginOutcome;
      }
    },
    onMutate: () => {
      setFormError(null);
    },
    onSuccess: (outcome: PasswordLoginOutcome) => {
      if (outcome.kind === 'authenticated') {
        onAuthenticated(outcome.result);
      } else {
        onVerificationRequired({ flow: 'signup', dispatch: outcome.dispatch });
      }
    },
    onError: (error) => {
      captcha.reset();
      if (error instanceof Error && error.message === 'captcha') {
        return;
      }
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
      {captcha.field}
      {captcha.missing && <p className="text-sm text-danger">{t('login.captcha')}</p>}
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

const otpLoginSchema = loginOtpRequestSchema.omit({ purpose: true });

function OtpLogin({
  siteKey,
  onCodeSent,
}: {
  siteKey: string;
  onCodeSent: (verification: PendingVerification) => void;
}) {
  const t = useTranslations('auth');
  const { validationMessage, errorMessage } = useAuthMessages();
  const captcha = useLoginCaptcha(siteKey);
  const id = useId();
  const form = useForm({
    resolver: zodResolver(otpLoginSchema, undefined, { raw: true }),
    defaultValues: { email: '' },
  });

  const request = useMutation({
    mutationFn: async (email: string) => {
      const captchaToken = captcha.consume();
      if (captchaToken === null) {
        throw new Error('captcha');
      }
      return authApi.requestOtp({
        purpose: 'LOGIN',
        email,
        ...(captchaToken === '' ? {} : { captchaToken }),
      });
    },
    onSuccess: (dispatch, email) => {
      onCodeSent({ flow: 'login', dispatch: { ...dispatch, email } });
    },
    onError: (error) => {
      captcha.reset();
      if (error instanceof Error && error.message === 'captcha') {
        return;
      }
      applyServerIssues(error, form.setError, ['email']);
    },
  });

  const emailError = validationMessage(form.formState.errors.email?.message);
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
          request.mutate(values.email);
        })(event);
      }}
    >
      <p className="text-sm text-muted-foreground">{t('login.otpHint')}</p>
      {requestError !== null && <Alert tone="danger">{requestError}</Alert>}
      <Field id={`${id}-email`} label={t('fields.email')} error={emailError}>
        <Input
          {...controlProps(`${id}-email`, { error: emailError })}
          type="email"
          autoComplete="email"
          dir="ltr"
          {...form.register('email')}
        />
      </Field>
      {captcha.field}
      {captcha.missing && <p className="text-sm text-danger">{t('login.captcha')}</p>}
      <Button type="submit" size="lg" loading={request.isPending}>
        {t('login.sendCode')}
      </Button>
    </form>
  );
}

/** Connexion par mot de passe ou par code à usage unique, puis confirmation de l'email si besoin. */
export function LoginForm({
  portal,
  nextPath,
  siteKey,
  demo = null,
}: {
  portal: Portal;
  nextPath: string | null;
  siteKey: string;
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
      {portal === 'client' && (
        <Alert title={t('clientAccount.title')}>{t('clientAccount.text')}</Alert>
      )}
      <Tabs value={method} onValueChange={setMethod}>
        <TabsList className="grid w-full grid-cols-2" aria-label={t('login.methodsLabel')}>
          <TabsTrigger value="password">
            <KeyRound className="size-4" aria-hidden="true" />
            {t('login.methodPassword')}
          </TabsTrigger>
          <TabsTrigger value="otp">
            <Mail className="size-4" aria-hidden="true" />
            {t('login.methodOtp')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-6">
          <PasswordLogin
            key={prefill.version}
            siteKey={siteKey}
            initialValues={prefill.values}
            redirecting={redirecting}
            onAuthenticated={complete}
            onVerificationRequired={setVerification}
          />
        </TabsContent>
        <TabsContent value="otp" className="mt-6">
          <OtpLogin siteKey={siteKey} onCodeSent={setVerification} />
        </TabsContent>
      </Tabs>

      {portal !== 'admin' && (
        <p className="text-center text-sm text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link
            href={
              nextPath === null ? '/signup' : { pathname: '/signup', query: { next: nextPath } }
            }
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
