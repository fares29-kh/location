import { Building2, CalendarCheck, House, type LucideIcon, Search, UserRound } from 'lucide-react';

export interface ClientNavItem {
  id: 'home' | 'search' | 'agencies' | 'bookings' | 'account';
  /** `null` tant que la page n'existe pas (affichée « Bientôt »). */
  href: string | null;
  icon: LucideIcon;
}

export const HEADER_NAV: readonly ClientNavItem[] = [
  { id: 'home', href: '/', icon: House },
  { id: 'search', href: null, icon: Search },
  { id: 'agencies', href: null, icon: Building2 },
  { id: 'bookings', href: null, icon: CalendarCheck },
];

export const BOTTOM_NAV: readonly ClientNavItem[] = [
  { id: 'home', href: '/', icon: House },
  { id: 'search', href: null, icon: Search },
  { id: 'bookings', href: null, icon: CalendarCheck },
  { id: 'account', href: null, icon: UserRound },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
