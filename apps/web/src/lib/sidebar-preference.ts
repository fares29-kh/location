import type { Portal } from '@drivetn/types';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Préférence « barre latérale repliée » stockée en cookie : le rendu serveur affiche
 * directement l'état choisi, sans saut visuel ni écart d'hydratation.
 */
export function sidebarCookieName(portal: Portal): string {
  return `drivetn_${portal}_sidebar_collapsed`;
}

export function persistSidebarCollapsed(portal: Portal, collapsed: boolean): void {
  document.cookie = `${sidebarCookieName(portal)}=${collapsed ? '1' : '0'}; path=/; max-age=${String(ONE_YEAR_SECONDS)}; samesite=lax`;
}
