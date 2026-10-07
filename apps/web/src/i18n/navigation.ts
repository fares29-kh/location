import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/** Liens et navigation localisés : préfixent automatiquement `/ar` ou `/en`. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
