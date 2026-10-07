'use client';

import type { Portal } from '@drivetn/types';
import { toast } from '@drivetn/ui/toaster';
import { useMutation } from '@tanstack/react-query';
import { useLocale } from 'next-intl';

import { authApi } from '@/lib/api/auth';
import { localizePath } from '@/lib/portal';

import { useAuthMessages } from './use-auth-messages';

/** Déconnexion puis rechargement complet (accueil côté client, connexion sur les espaces privés). */
export function useLogout(portal: Portal) {
  const locale = useLocale();
  const { errorMessage } = useAuthMessages();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      window.location.assign(localizePath(locale, portal === 'client' ? '/' : '/login'));
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });
}
