'use client';

import { VEHICLE_PHOTO_MAX_BYTES, VEHICLE_PHOTO_TYPES, VEHICLE_PHOTOS_MAX } from '@drivetn/types';
import { cn } from '@drivetn/ui/lib/cn';
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import {
  movePhotoDraft,
  type PhotoDraft,
  photoDraftUrl,
  type PhotoRejection,
  selectPhotoFiles,
} from '@/lib/agency/vehicle-photos';

const MAX_MEGABYTES = VEHICLE_PHOTO_MAX_BYTES / (1024 * 1024);
const ACCEPT = VEHICLE_PHOTO_TYPES.join(',');

function hasFiles(event: DragEvent) {
  return event.dataTransfer.types.includes('Files');
}

/**
 * Photos d'un véhicule : ajout (parcourir ou glisser-déposer), retrait et ordre.
 * La première photo sert de couverture. Rien n'est envoyé avant l'enregistrement du formulaire.
 */
export function VehiclePhotosField({
  value,
  onChange,
  disabled = false,
}: {
  value: PhotoDraft[];
  onChange: (drafts: PhotoDraft[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('agency.fleet.form.photos');
  const inputId = useId();
  const hintId = useId();
  const [rejections, setRejections] = useState<{ name: string; reason: PhotoRejection }[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | 'files' | null>(null);

  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(
    () => () => {
      for (const draft of latest.current) {
        if (draft.kind === 'new') {
          URL.revokeObjectURL(draft.previewUrl);
        }
      }
    },
    [],
  );

  const remaining = VEHICLE_PHOTOS_MAX - value.length;

  const addFiles = (files: readonly File[]) => {
    if (disabled || files.length === 0) {
      return;
    }
    const { accepted, rejected } = selectPhotoFiles(files, value.length);
    setRejections(rejected.map(({ file, reason }) => ({ name: file.name, reason })));
    if (accepted.length > 0) {
      onChange([
        ...value,
        ...accepted.map((file): PhotoDraft => ({
          kind: 'new',
          key: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    }
  };

  const remove = (index: number) => {
    const draft = value[index];
    if (draft?.kind === 'new') {
      URL.revokeObjectURL(draft.previewUrl);
    }
    onChange(value.filter((_, position) => position !== index));
    setRejections([]);
  };

  const move = (from: number, to: number) => {
    onChange(movePhotoDraft(value, from, to));
  };

  const limitReached = rejections.some(({ reason }) => reason === 'limit');
  const messages = [
    ...rejections
      .filter(({ reason }) => reason !== 'limit')
      .map(({ name, reason }) =>
        reason === 'type'
          ? t('rejectedType', { name })
          : t('rejectedSize', { name, size: MAX_MEGABYTES }),
      ),
    ...(limitReached ? [t('rejectedLimit', { max: VEHICLE_PHOTOS_MAX })] : []),
  ];

  return (
    <div
      className={cn(
        'grid gap-3 rounded-control transition-shadow',
        dropTarget === 'files' && 'ring-2 ring-ring ring-offset-4 ring-offset-surface',
      )}
      onDragOver={(event) => {
        if (hasFiles(event) && !disabled && remaining > 0) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setDropTarget('files');
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTarget(null);
        }
      }}
      onDrop={(event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          setDropTarget(null);
          addFiles(Array.from(event.dataTransfer.files));
        }
      }}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.map((draft, index) => (
          <li
            key={draft.key}
            draggable={!disabled}
            className={cn(
              'group relative aspect-[4/3] overflow-hidden rounded-control border border-border bg-surface-muted',
              dragIndex === index && 'opacity-40',
              dropTarget === index && dragIndex !== index && 'ring-2 ring-ring',
            )}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', draft.key);
              setDragIndex(index);
            }}
            onDragOver={(event) => {
              if (dragIndex !== null) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTarget(index);
              }
            }}
            onDrop={(event) => {
              if (dragIndex !== null) {
                event.preventDefault();
                event.stopPropagation();
                move(dragIndex, index);
              }
              setDragIndex(null);
              setDropTarget(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropTarget(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçus locaux (blob:) et médias déjà redimensionnés */}
            <img
              src={photoDraftUrl(draft)}
              alt={t('alt', { index: index + 1 })}
              draggable={false}
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
              {index === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground shadow-sm">
                  <Star className="size-3 fill-current" aria-hidden="true" />
                  {t('cover')}
                </span>
              ) : (
                <span />
              )}
              {draft.kind === 'new' && (
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] font-medium text-white">
                  {t('pending')}
                </span>
              )}
            </div>
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 transition-opacity',
                'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
              )}
            >
              <div className="flex gap-1">
                <PhotoAction
                  label={t('moveEarlier')}
                  disabled={disabled || index === 0}
                  onClick={() => {
                    move(index, index - 1);
                  }}
                >
                  <ChevronLeft className="rtl:-scale-x-100" />
                </PhotoAction>
                <PhotoAction
                  label={t('moveLater')}
                  disabled={disabled || index === value.length - 1}
                  onClick={() => {
                    move(index, index + 1);
                  }}
                >
                  <ChevronRight className="rtl:-scale-x-100" />
                </PhotoAction>
                {index > 0 && (
                  <PhotoAction
                    label={t('makeCover')}
                    disabled={disabled}
                    onClick={() => {
                      move(index, 0);
                    }}
                  >
                    <Star />
                  </PhotoAction>
                )}
              </div>
              <PhotoAction
                label={t('remove')}
                disabled={disabled}
                onClick={() => {
                  remove(index);
                }}
              >
                <Trash2 />
              </PhotoAction>
            </div>
          </li>
        ))}
        {remaining > 0 && (
          <li className={cn(value.length === 0 && 'col-span-2 sm:col-span-3')}>
            <label
              htmlFor={inputId}
              className={cn(
                'flex h-full min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-border p-4 text-center transition-colors',
                'hover:border-primary/60 hover:bg-primary/5 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30',
                value.length > 0 && 'aspect-[4/3] min-h-0',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <ImagePlus className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium">{t('add')}</span>
              {value.length === 0 && (
                <span className="text-xs text-muted-foreground">{t('dropHint')}</span>
              )}
              <span className="text-xs tabular-nums text-muted-foreground">
                {t('count', { count: value.length, max: VEHICLE_PHOTOS_MAX })}
              </span>
              <input
                id={inputId}
                type="file"
                accept={ACCEPT}
                multiple
                disabled={disabled}
                aria-describedby={hintId}
                className="sr-only"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
            </label>
          </li>
        )}
      </ul>
      <p id={hintId} className="text-sm text-muted-foreground">
        {t('hint', { size: MAX_MEGABYTES, max: VEHICLE_PHOTOS_MAX })}
      </p>
      {messages.length > 0 && (
        <ul role="alert" className="grid gap-1 text-sm font-medium text-danger">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhotoAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
