import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getPageItems, Pagination } from './pagination';

const labels = {
  navigation: 'Pagination',
  previous: 'Page précédente',
  next: 'Page suivante',
  page: (page: number) => `Page ${String(page)}`,
};

describe('getPageItems', () => {
  it('liste toutes les pages quand il y en a peu', () => {
    expect(getPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('insère des ellipses autour de la page courante', () => {
    expect(getPageItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 10]);
    expect(getPageItems(5, 10)).toEqual([1, 'ellipsis-start', 4, 5, 6, 'ellipsis-end', 10]);
    expect(getPageItems(10, 10)).toEqual([1, 'ellipsis-start', 6, 7, 8, 9, 10]);
  });
});

describe('Pagination', () => {
  it('ne rend rien pour une seule page', () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={vi.fn()} labels={labels} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('marque la page courante et navigue', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
