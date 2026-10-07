import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { PhoneInput } from './phone-input';

function ControlledPhoneInput({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneInput aria-label="Téléphone" value={value} onValueChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('PhoneInput', () => {
  it('affiche l’indicatif +216 et groupe les chiffres pendant la saisie', async () => {
    render(<ControlledPhoneInput />);
    expect(screen.getByText('+216')).toBeInTheDocument();
    const input = screen.getByLabelText('Téléphone');
    await userEvent.type(input, '20123456');
    expect(input).toHaveValue('20 123 456');
    expect(screen.getByTestId('value')).toHaveTextContent('20123456');
  });

  it('ignore les caractères non numériques et limite à 8 chiffres', async () => {
    render(<ControlledPhoneInput />);
    const input = screen.getByLabelText('Téléphone');
    await userEvent.type(input, '9a8-7654321');
    expect(screen.getByTestId('value')).toHaveTextContent('98765432');
  });

  it('accepte le collage d’un numéro international', async () => {
    render(<ControlledPhoneInput />);
    const input = screen.getByLabelText('Téléphone');
    await userEvent.click(input);
    await userEvent.paste('+216 55 123 456');
    expect(screen.getByTestId('value')).toHaveTextContent('55123456');
    expect(input).toHaveValue('55 123 456');
  });

  it('reste en ltr même dans une page arabe', () => {
    render(
      <div dir="rtl">
        <ControlledPhoneInput initial="20123456" />
      </div>,
    );
    expect(screen.getByLabelText('Téléphone').parentElement).toHaveAttribute('dir', 'ltr');
  });
});
