'use client';

import type { CurrentUser, Portal } from '@drivetn/types';
import { Avatar, AvatarFallback, getInitials } from '@drivetn/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@drivetn/ui/dropdown-menu';
import { cn } from '@drivetn/ui/lib/cn';
import { LogOut, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { useLogout } from './use-logout';

export function useRoleLabel() {
  const t = useTranslations('auth');
  return (user: CurrentUser) =>
    user.adminRole === null ? t(`roles.${user.role}`) : t(`adminRoles.${user.adminRole}`);
}

/** Avatar et menu du compte : identité, rôle, accès au compte (client) et déconnexion. */
export function UserMenu({
  user,
  portal,
  className,
}: {
  user: CurrentUser;
  portal: Portal;
  className?: string;
}) {
  const t = useTranslations('auth.userMenu');
  const roleLabel = useRoleLabel();
  const logout = useLogout(portal);
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('label')}
        className={cn(
          'rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
      >
        <Avatar className="size-9">
          <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 py-2">
          <span className="truncate text-sm font-semibold text-foreground">{fullName}</span>
          <span className="truncate font-normal">{roleLabel(user)}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {portal === 'client' && (
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound aria-hidden="true" />
              {t('account')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          destructive
          disabled={logout.isPending}
          onSelect={() => {
            logout.mutate();
          }}
        >
          <LogOut aria-hidden="true" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
