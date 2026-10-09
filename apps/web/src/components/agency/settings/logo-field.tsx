'use client';

import { AGENCY_LOGO_MAX_BYTES, isVehiclePhotoType, VEHICLE_PHOTO_TYPES } from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { toast } from '@drivetn/ui/toaster';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';

import { AgencyLogo } from '@/components/agencies/agency-logo';
import { useRemoveLogo, useUploadLogo } from '@/lib/agency/queries';
import { ApiError } from '@/lib/api/errors';

const MAX_MEGABYTES = AGENCY_LOGO_MAX_BYTES / (1024 * 1024);
const ACCEPT = VEHICLE_PHOTO_TYPES.join(',');

function isInvalidImage(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.validationIssues.some(
      (issue) => issue.message === 'INVALID_IMAGE' || issue.message === 'UNSUPPORTED_IMAGE_TYPE',
    )
  );
}

/** Logo de l'agence : envoyé dès la sélection, indépendamment du reste de la fiche. */
export function LogoField({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const t = useTranslations('agency.settings.profile');
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadLogo();
  const remove = useRemoveLogo();
  const busy = upload.isPending || remove.isPending;

  const send = async (file: File) => {
    if (!isVehiclePhotoType(file.type)) {
      toast.error(t('logoInvalid'));
      return;
    }
    if (file.size > AGENCY_LOGO_MAX_BYTES) {
      toast.error(t('logoTooLarge', { size: MAX_MEGABYTES }));
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast.success(t('logoSaved'));
    } catch (error) {
      toast.error(isInvalidImage(error) ? t('logoInvalid') : t('logoError'));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AgencyLogo name={name} logoUrl={logoUrl} className="size-20 rounded-card text-xl" />
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="text-sm font-medium" id={`${inputId}-label`}>
          {t('logo')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={upload.isPending}
            disabled={busy}
            aria-describedby={hintId}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            {logoUrl === null ? t('logoUpload') : t('logoReplace')}
          </Button>
          {logoUrl !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={remove.isPending}
              disabled={busy}
              onClick={() => {
                remove.mutate(undefined, {
                  onSuccess: () => toast.success(t('logoRemoved')),
                  onError: () => toast.error(t('logoRemoveError')),
                });
              }}
            >
              <Trash2 aria-hidden="true" />
              {t('logoRemove')}
            </Button>
          )}
        </div>
        <p id={hintId} className="text-xs text-muted-foreground">
          {t('logoHint', { size: MAX_MEGABYTES })}
        </p>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-labelledby={`${inputId}-label`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file !== undefined) {
              void send(file);
            }
          }}
        />
      </div>
    </div>
  );
}
