'use client';

import {
  type AdminVehicleBrand,
  type AdminVehicleCategory,
  type AdminVehicleModel,
  pickLocalized,
  vehicleBrandKey,
} from '@drivetn/types';
import { Alert } from '@drivetn/ui/alert';
import { Badge } from '@drivetn/ui/badge';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { EmptyState } from '@drivetn/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@drivetn/ui/tabs';
import { Plus, Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/agency/page-header';
import { QueryError, TableSkeleton } from '@/components/agency/query-states';
import { SearchField } from '@/components/agency/search-field';
import { useAgencyFormat } from '@/components/agency/use-agency-format';
import { useUrlState } from '@/components/agency/use-url-state';
import {
  useAdminVehicleBrands,
  useAdminVehicleCategories,
  useAdminVehicleModels,
  useDeleteVehicleBrand,
  useDeleteVehicleCategory,
  useDeleteVehicleModel,
} from '@/lib/admin/queries';

import { useAdminPermission } from '../admin-session';
import {
  AddButton,
  ColumnMessage,
  ColumnSkeleton,
  ReferentialColumn,
  ReferentialRow,
} from '../referentials/referential-columns';
import { DeleteReferentialDialog, RowActions } from '../referentials/referential-ui';
import { BrandDialog } from './brand-dialog';
import { CategoryDialog } from './category-dialog';
import { ModelDialog } from './model-dialog';

const TABS = ['categories', 'brands'] as const;
const URL_DEFAULTS = { tab: 'categories', brand: '' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  return key === 'tab' ? (TABS as readonly string[]).includes(value) : value.length > 0;
}

/** Élément en cours d'édition : `'new'` pour un ajout, `null` quand aucune fenêtre n'est ouverte. */
type Editing<T> = T | 'new' | null;

function CategoriesPanel({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations('admin.catalog.categories');
  const format = useAgencyFormat();
  const { data, isPending, isError, error, refetch, isFetching } = useAdminVehicleCategories();
  const remove = useDeleteVehicleCategory();
  const [editing, setEditing] = useState<Editing<AdminVehicleCategory>>(null);
  const [deleting, setDeleting] = useState<AdminVehicleCategory | null>(null);
  const nextPosition =
    data === undefined ? 0 : Math.max(-10, ...data.map((category) => category.position)) + 10;

  const addButton = canEdit ? (
    <Button
      size="sm"
      onClick={() => {
        setEditing('new');
      }}
    >
      <Plus aria-hidden="true" />
      {t('add')}
    </Button>
  ) : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('text')}</p>
        {addButton}
      </div>
      {isPending ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={t('emptyTitle')}
          description={t('emptyText')}
          action={addButton}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('columns.position')}</TableHead>
                <TableHead>{t('columns.name')}</TableHead>
                <TableHead>{t('columns.slug')}</TableHead>
                <TableHead>{t('columns.vehicles')}</TableHead>
                {canEdit && (
                  <TableHead>
                    <span className="sr-only">{t('columns.actions')}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((category) => {
                const name = pickLocalized(category.name, format.locale);
                const description = pickLocalized(category.description, format.locale);
                return (
                  <TableRow key={category.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {category.position}
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-0.5">
                        <span className="font-medium">{name}</span>
                        {description.length > 0 && (
                          <span className="line-clamp-1 text-sm text-muted-foreground">
                            {description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code dir="ltr" className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                        {category.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <VehiclesCount count={category.vehiclesCount} />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <RowActions
                          name={name}
                          inUse={category.vehiclesCount > 0}
                          onEdit={() => {
                            setEditing(category);
                          }}
                          onDelete={() => {
                            setDeleting(category);
                          }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {editing !== null && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          nextPosition={nextPosition}
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
    </div>
  );
}

function VehiclesCount({ count }: { count: number }) {
  const t = useTranslations('admin.catalog');
  return (
    <Badge tone={count > 0 ? 'primary' : 'neutral'} className="tabular-nums">
      {t('vehiclesCount', { count })}
    </Badge>
  );
}

function BrandsColumn({
  canEdit,
  selected,
  onSelect,
}: {
  canEdit: boolean;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('admin.catalog.brands');
  const { data, isPending, isError, error, refetch, isFetching } = useAdminVehicleBrands();
  const remove = useDeleteVehicleBrand();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Editing<AdminVehicleBrand>>(null);
  const [deleting, setDeleting] = useState<AdminVehicleBrand | null>(null);

  const brands = useMemo(() => {
    const key = vehicleBrandKey(search);
    return key.length === 0
      ? (data ?? [])
      : (data ?? []).filter((brand) => vehicleBrandKey(brand.name).includes(key));
  }, [data, search]);

  return (
    <ReferentialColumn
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
      toolbar={
        <SearchField
          value={search}
          onValueChange={setSearch}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          className="sm:max-w-none"
        />
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
      ) : brands.length === 0 ? (
        <ColumnMessage>
          <p>{t('noResults', { search })}</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setSearch('');
            }}
          >
            {t('clearSearch')}
          </Button>
        </ColumnMessage>
      ) : (
        <ul>
          {brands.map((brand) => (
            <ReferentialRow
              key={brand.id}
              title={brand.name}
              meta={t('stats', { models: brand.modelsCount, vehicles: brand.vehiclesCount })}
              selected={brand.id === selected}
              onSelect={() => {
                onSelect(brand.id);
              }}
              actions={
                canEdit ? (
                  <RowActions
                    name={brand.name}
                    inUse={brand.vehiclesCount > 0}
                    onEdit={() => {
                      setEditing(brand);
                    }}
                    onDelete={() => {
                      setDeleting(brand);
                    }}
                  />
                ) : undefined
              }
            />
          ))}
        </ul>
      )}

      {editing !== null && (
        <BrandDialog
          brand={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <DeleteReferentialDialog
        name={deleting?.name ?? null}
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
    </ReferentialColumn>
  );
}

function ModelsColumn({ canEdit, brand }: { canEdit: boolean; brand: AdminVehicleBrand | null }) {
  const t = useTranslations('admin.catalog.models');
  const tCatalog = useTranslations('admin.catalog');
  const query = useAdminVehicleModels(brand?.id ?? null);
  const remove = useDeleteVehicleModel();
  const [editing, setEditing] = useState<Editing<AdminVehicleModel>>(null);
  const [deleting, setDeleting] = useState<AdminVehicleModel | null>(null);

  return (
    <ReferentialColumn
      title={brand === null ? t('title') : t('titleFor', { brand: brand.name })}
      count={brand === null ? undefined : query.data?.length}
      action={
        canEdit && brand !== null ? (
          <AddButton
            label={t('add')}
            onClick={() => {
              setEditing('new');
            }}
          />
        ) : undefined
      }
    >
      {brand === null ? (
        <ColumnMessage>{t('selectBrand')}</ColumnMessage>
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
        <ColumnMessage>{t('empty', { brand: brand.name })}</ColumnMessage>
      ) : (
        <ul>
          {query.data.map((model) => (
            <ReferentialRow
              key={model.id}
              title={model.name}
              meta={tCatalog('vehiclesCount', { count: model.vehiclesCount })}
              actions={
                canEdit ? (
                  <RowActions
                    name={`${brand.name} ${model.name}`}
                    inUse={model.vehiclesCount > 0}
                    onEdit={() => {
                      setEditing(model);
                    }}
                    onDelete={() => {
                      setDeleting(model);
                    }}
                  />
                ) : undefined
              }
            />
          ))}
        </ul>
      )}

      {editing !== null && brand !== null && (
        <ModelDialog
          brand={brand}
          model={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      <DeleteReferentialDialog
        name={deleting === null || brand === null ? null : `${brand.name} ${deleting.name}`}
        pending={remove.isPending}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => remove.mutateAsync(deleting?.id ?? '')}
      />
    </ReferentialColumn>
  );
}

/** Marques à gauche, modèles de la marque choisie à droite. */
function BrandsPanel({
  canEdit,
  selected,
  onSelect,
}: {
  canEdit: boolean;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const brands = useAdminVehicleBrands();
  const brand = brands.data?.find((item) => item.id === selected) ?? null;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <BrandsColumn canEdit={canEdit} selected={selected} onSelect={onSelect} />
      <ModelsColumn canEdit={canEdit} brand={brand} />
    </div>
  );
}

export function CatalogView() {
  const t = useTranslations('admin.catalog');
  const tRef = useTranslations('admin.referentials');
  const canEdit = useAdminPermission('referentials.manage');
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);

  return (
    <div className="grid gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      {!canEdit && (
        <Alert tone="info" title={tRef('readOnlyTitle')}>
          {tRef('readOnlyText')}
        </Alert>
      )}
      <Tabs
        value={params.tab}
        onValueChange={(tab) => {
          setParams({ tab });
        }}
      >
        <TabsList aria-label={t('tabsLabel')}>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="categories">
          <CategoriesPanel canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="brands">
          <BrandsPanel
            canEdit={canEdit}
            selected={params.brand}
            onSelect={(brand) => {
              setParams({ brand });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
