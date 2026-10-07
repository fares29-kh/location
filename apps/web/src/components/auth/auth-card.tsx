import { Card, CardContent, CardDescription, CardHeader } from '@drivetn/ui/card';
import type { ReactNode } from 'react';

/** Carte des pages d'authentification : titre de page (h1), sous-titre, formulaire. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="gap-2 pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
        {description !== undefined && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
