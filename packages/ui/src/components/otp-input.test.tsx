import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { OtpInput } from './otp-input';

function ControlledOtp({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <OtpInput
      value={value}
      onValueChange={setValue}
      onComplete={onComplete}
      getInputLabel={(index, length) => `Chiffre ${String(index + 1)} sur ${String(length)}`}
    />
  );
}

function boxes(): HTMLInputElement[] {
  return screen.getAllByRole('textbox');
}

function firstBox(): HTMLInputElement {
  return screen.getByLabelText('Chiffre 1 sur 6');
}

describe('OtpInput', () => {
  it('rend 6 cases étiquetées, la première en one-time-code', () => {
    render(<ControlledOtp />);
    expect(boxes()).toHaveLength(6);
    expect(screen.getByLabelText('Chiffre 1 sur 6')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('avance automatiquement et signale la saisie complète', async () => {
    const onComplete = vi.fn();
    render(<ControlledOtp onComplete={onComplete} />);
    await userEvent.click(firstBox());
    await userEvent.keyboard('123456');
    expect(boxes().map((box) => box.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('ignore les caractères non numériques', async () => {
    render(<ControlledOtp />);
    await userEvent.click(firstBox());
    await userEvent.keyboard('a1b');
    expect(boxes()[0]).toHaveValue('1');
    expect(boxes()[1]).toHaveValue('');
    expect(boxes()[1]).toHaveFocus();
  });

  it('remplit toutes les cases au collage', async () => {
    const onComplete = vi.fn();
    render(<ControlledOtp onComplete={onComplete} />);
    await userEvent.click(firstBox());
    await userEvent.paste('Code : 654 321');
    expect(boxes().map((box) => box.value)).toEqual(['6', '5', '4', '3', '2', '1']);
    expect(onComplete).toHaveBeenCalledWith('654321');
  });

  it('efface et recule avec Retour arrière', async () => {
    render(<ControlledOtp />);
    await userEvent.click(firstBox());
    await userEvent.keyboard('12');
    await userEvent.keyboard('{Backspace}');
    expect(boxes()[0]).toHaveValue('1');
    expect(boxes()[1]).toHaveValue('');
    expect(boxes()[1]).toHaveFocus();
    await userEvent.keyboard('{Backspace}');
    expect(
      boxes()
        .map((box) => box.value)
        .join(''),
    ).toBe('');
    expect(boxes()[0]).toHaveFocus();
  });
});
