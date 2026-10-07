import { BOOKING_STATUSES, PAYMENT_STATUSES } from '@drivetn/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Rating, roundToHalf } from './rating';
import {
  BOOKING_STATUS_TONES,
  BookingStatusBadge,
  PAYMENT_STATUS_TONES,
  PaymentStatusBadge,
} from './status-badges';

describe('BookingStatusBadge', () => {
  it('associe une couleur à chaque statut de réservation', () => {
    expect(Object.keys(BOOKING_STATUS_TONES).sort()).toEqual([...BOOKING_STATUSES].sort());
    expect(BOOKING_STATUS_TONES.PENDING).toBe('warning');
    expect(BOOKING_STATUS_TONES.CONFIRMED).toBe('blue');
    expect(BOOKING_STATUS_TONES.PICKED_UP).toBe('violet');
    expect(BOOKING_STATUS_TONES.COMPLETED).toBe('success');
    expect(BOOKING_STATUS_TONES.CANCELLED).toBe('neutral');
    expect(BOOKING_STATUS_TONES.REJECTED).toBe('danger');
  });

  it('affiche le libellé fourni', () => {
    render(<BookingStatusBadge status="PENDING">En attente</BookingStatusBadge>);
    const badge = screen.getByText('En attente');
    expect(badge).toHaveAttribute('data-status', 'PENDING');
    expect(badge.className).toContain('bg-warning-soft');
  });
});

describe('PaymentStatusBadge', () => {
  it('associe une couleur à chaque statut de paiement', () => {
    expect(Object.keys(PAYMENT_STATUS_TONES).sort()).toEqual([...PAYMENT_STATUSES].sort());
  });

  it('affiche « payé » en vert', () => {
    render(<PaymentStatusBadge status="PAID">Payé</PaymentStatusBadge>);
    expect(screen.getByText('Payé').className).toContain('bg-success-soft');
  });
});

describe('Rating', () => {
  it('arrondit à la demi-étoile et borne la note', () => {
    expect(roundToHalf(4.3, 5)).toBe(4.5);
    expect(roundToHalf(4.2, 5)).toBe(4);
    expect(roundToHalf(7, 5)).toBe(5);
    expect(roundToHalf(-1, 5)).toBe(0);
  });

  it('expose la note via un libellé accessible', () => {
    const { container } = render(<Rating value={3.5} label="3,5 sur 5" />);
    expect(screen.getByRole('img', { name: '3,5 sur 5' })).toBeInTheDocument();
    const fills = [...container.querySelectorAll('[data-fill]')].map((star) =>
      star.getAttribute('data-fill'),
    );
    expect(fills).toEqual(['1', '1', '1', '0.5', '0']);
  });
});
