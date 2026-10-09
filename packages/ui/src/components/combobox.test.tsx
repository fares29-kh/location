import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Combobox, filterComboboxOptions } from './combobox';

const OPTIONS = [
  { value: 'Citroën', label: 'Citroën' },
  { value: 'Kia', label: 'Kia' },
  { value: 'Peugeot', label: 'Peugeot' },
  { value: 'Volkswagen', label: 'Volkswagen', keywords: 'vw' },
];

describe('filterComboboxOptions', () => {
  it('ignore la casse, les accents et cherche dans les mots-clés', () => {
    expect(filterComboboxOptions(OPTIONS, 'CITRO').map((option) => option.value)).toEqual([
      'Citroën',
    ]);
    expect(filterComboboxOptions(OPTIONS, 'citroen')).toHaveLength(1);
    expect(filterComboboxOptions(OPTIONS, 'vw').map((option) => option.value)).toEqual([
      'Volkswagen',
    ]);
    expect(filterComboboxOptions(OPTIONS, '  ')).toHaveLength(OPTIONS.length);
  });
});

describe('Combobox', () => {
  function setup(value = '') {
    const onValueChange = vi.fn();
    render(
      <Combobox
        aria-label="Marque"
        value={value}
        onValueChange={onValueChange}
        options={OPTIONS}
        placeholder="Choisir une marque"
        searchPlaceholder="Rechercher une marque"
        emptyText="Aucune marque"
      />,
    );
    return { onValueChange, user: userEvent.setup() };
  }

  it('affiche le libellé de la valeur ou le texte indicatif', () => {
    setup('Kia');
    expect(screen.getByRole('button', { name: 'Marque' })).toHaveTextContent('Kia');
  });

  it('filtre puis choisit au clavier', async () => {
    const { onValueChange, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Marque' }));
    const search = screen.getByRole('combobox', { name: 'Rechercher une marque' });
    expect(search).toHaveFocus();

    await user.type(search, 'pe');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('Peugeot');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('se déplace avec les flèches et annonce l’option active', async () => {
    const { onValueChange, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Marque' }));
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const search = screen.getByRole('combobox');
    const active = screen.getAllByRole('option')[2];
    expect(search).toHaveAttribute('aria-activedescendant', active?.id);
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('Peugeot');
  });

  it('indique quand aucune option ne correspond', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Marque' }));
    await user.type(screen.getByRole('combobox'), 'zzz');
    expect(screen.getByText('Aucune marque')).toBeInTheDocument();
  });
});
