'use client';

import { OTP_CHANNELS, type OtpChannel } from '@drivetn/types';
import { Label } from '@drivetn/ui/label';
import { RadioGroup, RadioGroupItem } from '@drivetn/ui/radio-group';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

export function ChannelPicker({
  value,
  onValueChange,
  disabled,
}: {
  value: OtpChannel;
  onValueChange: (channel: OtpChannel) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('auth.channel');
  const id = useId();

  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{t('label')}</legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const channel = OTP_CHANNELS.find((item) => item === next);
          if (channel !== undefined) {
            onValueChange(channel);
          }
        }}
        className="flex flex-wrap gap-4"
      >
        {OTP_CHANNELS.map((channel) => (
          <div key={channel} className="flex items-center gap-2">
            <RadioGroupItem value={channel} id={`${id}-${channel}`} />
            <Label htmlFor={`${id}-${channel}`} className="font-normal">
              {t(channel)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
