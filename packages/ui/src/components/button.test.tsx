import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('est de type "button" par défaut et déclenche onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Réserver</Button>);
    const button = screen.getByRole('button', { name: 'Réserver' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('se désactive et signale le chargement', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoyer
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Envoyer' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applique ses styles à l’enfant avec asChild', () => {
    render(
      <Button asChild variant="cta">
        <a href="/recherche">Rechercher</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Rechercher' });
    expect(link).toHaveAttribute('href', '/recherche');
    expect(link.className).toContain('bg-cta');
  });
});
