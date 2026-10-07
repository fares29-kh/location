import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface StepperStep {
  id: string;
  label: ReactNode;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** Index (0-based) de l'étape en cours. */
  currentStep: number;
  className?: string;
}

/** Progression d'un tunnel (ex. réservation en 4 étapes). */
export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((step, index) => {
        const state =
          index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        return (
          <li
            key={step.id}
            className="flex flex-1 flex-col items-center gap-2 text-center"
            aria-current={state === 'current' ? 'step' : undefined}
            data-state={state}
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  index === 0 ? 'invisible' : index <= currentStep ? 'bg-primary' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums transition-colors',
                  state === 'complete' && 'border-primary bg-primary text-primary-foreground',
                  state === 'current' &&
                    'border-primary bg-primary-soft text-primary-soft-foreground',
                  state === 'upcoming' && 'border-border bg-surface text-muted-foreground',
                )}
              >
                {state === 'complete' ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full',
                  index === steps.length - 1
                    ? 'invisible'
                    : index < currentStep
                      ? 'bg-primary'
                      : 'bg-border',
                )}
              />
            </div>
            <span
              className={cn(
                'text-xs font-medium sm:text-sm',
                state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
