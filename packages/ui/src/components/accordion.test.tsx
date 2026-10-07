import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

describe('Accordion', () => {
  it('ouvre et referme une réponse au clic', async () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="paiement">
          <AccordionTrigger>Dois-je payer en ligne ?</AccordionTrigger>
          <AccordionContent>Non, vous réglez l’agence.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole('button', { name: 'Dois-je payer en ligne ?' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Non, vous réglez l’agence.')).toBeVisible();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
