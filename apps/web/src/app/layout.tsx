import type { ReactNode } from 'react';

/**
 * Chaque portail possède son propre document HTML (`app/{portail}/[locale]/layout.tsx`),
 * qui fixe la langue et le sens de lecture. Ce layout racine se contente de transmettre.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
