'use client';

import {
  type AdminDelegation,
  type AdminGovernorate,
  type AdminMunicipality,
  pickLocalized,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PageHeader } from '@/components/agency/page-header';
import { QueryError } from '@/components/agency/query-states';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import {
  useAdminDelegations,
  useAdminGovernorates,
  useAdminMunicipalities,
  useCreateDelegation,
  useCreateMunicipality,
  useDeleteDelegation,
  useDeleteGovernorate,
  useDeleteMunicipality,
  useUpdateDelegation,
  useUpdateMunicipality,
} from '@/lib/admin/queries';

import { useAdminPermission } from '../admin-session';
import {
  AddButton,
  ColumnMessage,
  ColumnSkeleton,
  ReferentialColumn as Column,
  ReferentialRow as PlaceRow,
} from '../referentials/referential-columns';
import { DeleteReferentialDialog, RowActions } from '../referentials/referential-ui';
import { GovernorateDialog, PlaceNameDialog } from './geography-dialogs';

const URL_DEFAULTS = { gov: '', del: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  return key === 'gov' ? /^\d{2}$/.test(value) : value.length > 0;
}

type Editing<T> = T | 'new' | null;

function GovernoratesColumn({
  canEdit,
  selected,
  onSelect,
}: {
  canEdit: boolean;
  selected: string;
  onSelect: (code: string) => void;
}) {
  const t = useTranslations('admin.geography.governorates');
  const format = useAgencyFormat();
  const { data, isPending, isError, error, refetch, isFetching } = useAdminGovernorates();
  const remove = useDeleteGovernorate();
  const [editing, setEditing] = useState<Editing<AdminGovernorate>>(null);
  const [deleting, setDeleting] = useState<AdminGovernorate | null>(null);

  return (
    <Column
      title={t('title')}
      count={data?.length}
      action={
        canEdit ? (
          <AddButton
            label={t('add')}
            onClick={() => {
              setEditing('new');
            }}
          />
        ) : undefined
      }
    >
      {isPending ? (
        <ColumnSkeleton />
      ) : isError ? (
        <QueryError
          className="border-0"
          error={error}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : data.length === 0 ? (
        <ColumnMessage>{t('empty')}</ColumnMessage>
      ) : (
        <ul>
          {data.map((governorate) => {
            const name = pickLocalized(governorate.name, format.locale);
            return (
              <PlaceRow
                key={governorate.code}
                title={
                  <>
                    <span className="me-2 font-mono text-xs text-muted-foreground" dir="ltr">
                      {governorate.code}
                    </span>
                    {name}
                  </>
                }
                meta={t('stats', {
                  delegations: governorate.delegationsCount,
                  agencies: governorate.agenciesCount,
                })}
                selected={governorate.code === selected}
                onSelect={() => {
                  onSelect(governorate.code);
                }}
                actions={
                  canEdit ? (
                    <RowActions
                      name={name}
                      inUse={
                        governorate.delegationsCount +
                          governorate.agenciesCount +
                          governorate.locationsCount >
                        0
                      }
                      onEdit={() => {
                        setEditing(governorate);
                      }}
                      onDelete={() => {
                        setDeleting(governorate);
                      }}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}

      {editing !== null && (
        <GovernorateDialog
          governorate={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <DeleteReferentialDialog
        name={deleting === null ? null : pickLocalized(deleting.name, format.locale)}
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={async () => {
          const code = deleting?.code ?? '';
          await remove.mutateAsync(code);
          if (code === selected) {
            onSelect('');
          }
        }}
      />
    </Column>
  );
}

function DelegationsColumn({
  canEdit,
  governorate,
  selected,
  onSelect,
}: {
  canEdit: boolean;
  governorate: AdminGovernorate | null;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('admin.geography.delegations');
  const format = useAgencyFormat();
  const query = useAdminDelegations(governorate?.code ?? null);
  const create = useCreateDelegation();
  const update = useUpdateDelegation();
  const remove = useDeleteDelegation();
  const [editing, setEditing] = useState<Editing<AdminDelegation>>(null);
  const [deleting, setDeleting] = useState<AdminDelegation | null>(null);
  const governorateName =
    governorate === null ? '' : pickLocalized(governorate.name, format.locale);

  return (
    <Column
      title={t('title')}
      count={governorate === null ? undefined : query.data?.length}
      action={
        canEdit && governorate !== null ? (
          <AddButton
            label={t('add')}
            onClick={() => {
              setEditing('new');
            }}
          />
        ) : undefined
      }
    >
      {governorate === null ? (
        <ColumnMessage>{t('selectGovernorate')}</ColumnMessage>
      ) : query.isPending ? (
        <ColumnSkeleton />
      ) : query.isError ? (
        <QueryError
          className="border-0"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data.length === 0 ? (
        <ColumnMessage>{t('empty', { governorate: governorateName })}</ColumnMessage>
      ) : (
        <ul>
          {query.data.map((delegation) => {
            const name = pickLocalized(delegation.name, format.locale);
            return (
              <PlaceRow
                key={delegation.id}
                title={name}
                meta={t('municipalitiesCount', { count: delegation.municipalitiesCount })}
                selected={delegation.id === selected}
                onSelect={() => {
                  onSelect(delegation.id);
                }}
                actions={
                  canEdit ? (
                    <RowActions
                      name={name}
                      inUse={delegation.municipalitiesCount > 0}
                      onEdit={() => {
                        setEditing(delegation);
                      }}
                      onDelete={() => {
                        setDeleting(delegation);
                      }}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}

      {editing !== null && governorate !== null && (
        <PlaceNameDialog
          title={editing === 'new' ? t('createTitle') : t('editTitle')}
          description={t('context', { governorate: governorateName })}
          isNew={editing === 'new'}
          defaultName={editing === 'new' ? null : editing.name}
          pending={create.isPending || update.isPending}
          onSave={(name) =>
            editing === 'new'
              ? create.mutateAsync({ governorateCode: governorate.code, name })
              : update.mutateAsync({ id: editing.id, input: { name } })
          }
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <DeleteReferentialDialog
        name={deleting === null ? null : pickLocalized(deleting.name, format.locale)}
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={async () => {
          const id = deleting?.id ?? '';
          await remove.mutateAsync(id);
          if (id === selected) {
            onSelect('');
          }
        }}
      />
    </Column>
  );
}

function MunicipalitiesColumn({
  canEdit,
  delegation,
}: {
  canEdit: boolean;
  delegation: AdminDelegation | null;
}) {
  const t = useTranslations('admin.geography.municipalities');
  const format = useAgencyFormat();
  const query = useAdminMunicipalities(delegation?.id ?? null);
  const create = useCreateMunicipality();
  const update = useUpdateMunicipality();
  const remove = useDeleteMunicipality();
  const [editing, setEditing] = useState<Editing<AdminMunicipality>>(null);
  const [deleting, setDeleting] = useState<AdminMunicipality | null>(null);
  const delegationName = delegation === null ? '' : pickLocalized(delegation.name, format.locale);

  return (
    <Column
      title={t('title')}
      count={delegation === null ? undefined : query.data?.length}
      action={
        canEdit && delegation !== null ? (
          <AddButton
            label={t('add')}
            onClick={() => {
              setEditing('new');
            }}
          />
        ) : undefined
      }
    >
      {delegation === null ? (
        <ColumnMessage>{t('selectDelegation')}</ColumnMessage>
      ) : query.isPending ? (
        <ColumnSkeleton />
      ) : query.isError ? (
        <QueryError
          className="border-0"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : query.data.length === 0 ? (
        <ColumnMessage>{t('empty', { delegation: delegationName })}</ColumnMessage>
      ) : (
        <ul>
          {query.data.map((municipality) => {
            const name = pickLocalized(municipality.name, format.locale);
            return (
              <PlaceRow
                key={municipality.id}
                title={name}
                actions={
                  canEdit ? (
                    <RowActions
                      name={name}
                      inUse={false}
                      onEdit={() => {
                        setEditing(municipality);
                      }}
                      onDelete={() => {
                        setDeleting(municipality);
                      }}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </ul>
      )}

      {editing !== null && delegation !== null && (
        <PlaceNameDialog
          title={editing === 'new' ? t('createTitle') : t('editTitle')}
          description={t('context', { delegation: delegationName })}
          isNew={editing === 'new'}
          defaultName={editing === 'new' ? null : editing.name}
          pending={create.isPending || update.isPending}
          onSave={(name) =>
            editing === 'new'
              ? create.mutateAsync({ delegationId: delegation.id, name })
              : update.mutateAsync({ id: editing.id, input: { name } })
          }
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <DeleteReferentialDialog
        name={deleting === null ? null : pickLocalized(deleting.name, format.locale)}
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => remove.mutateAsync(deleting?.id ?? '')}
      />
    </Column>
  );
}

export function GeographyView() {
  const t = useTranslations('admin.geography');
  const tRef = useTranslations('admin.referentials');
  const canEdit = useAdminPermission('referentials.manage');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const governorates = useAdminGovernorates();
  const governorate = governorates.data?.find((item) => item.code === params.gov) ?? null;
  const delegations = useAdminDelegations(governorate?.code ?? null);
  const delegation =
    governorate === null
      ? null
      : (delegations.data?.find((item) => item.id === params.del) ?? null);

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      {!canEdit && (
        <Alert tone="info" title={tRef('readOnlyTitle')}>
          {tRef('readOnlyText')}
        </Alert>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <GovernoratesColumn
          canEdit={canEdit}
          selected={params.gov}
          onSelect={(gov) => {
            setParams({ gov, del: '' });
          }}
        />
        <DelegationsColumn
          canEdit={canEdit}
          governorate={governorate}
          selected={params.del}
          onSelect={(del) => {
            setParams({ del });
          }}
        />
        <MunicipalitiesColumn canEdit={canEdit} delegation={delegation} />
      </div>
    </div>
  );
}
