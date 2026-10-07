import { IBM_Plex_Sans_Arabic, Inter, Plus_Jakarta_Sans } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

/** Téléchargée uniquement quand des glyphes arabes sont affichés (unicode-range). */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
  preload: false,
});

export const fontVariables = [inter.variable, jakarta.variable, plexArabic.variable].join(' ');
