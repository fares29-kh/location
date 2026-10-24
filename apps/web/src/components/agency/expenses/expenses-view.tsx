'use client';

import {
  EXPENSE_AMOUNT_MAX_MILLIMES,
  EXPENSE_CATEGORIES,
  EXPENSE_NOTE_MAX,
  type ExpenseCategory,
  type ExpenseQuery,
  type ExpenseView,
  millimesToDinarInput,
  parseDinars,
} from '@drivetn/types';
import { Button } from '@drivetn/ui/button';
import { Card } from '@drivetn/ui/card';
import { cn } from '@drivetn/ui/lib/cn';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@drivetn/ui/dialog';
import { EmptyState } from '@drivetn/ui/empty-state';
import { Field } from '@drivetn/ui/field';
import { Input } from '@drivetn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@drivetn/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@drivetn/ui/table';
import { Textarea } from '@drivetn/ui/textarea';
import { toast } from '@drivetn/ui/toaster';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { controlProps } from '@/components/auth/control-props';
import { addMonths, todayKey } from '@/lib/agency/dates';
import { useDeleteExpense, useExpenses, useSaveExpense, useVehicles } from '@/lib/agency/queries';
import { ApiError } from '@/lib/api/errors';

import { ConfirmDialog } from '../confirm-dialog';
import { FilterTabs } from '../filter-tabs';
import { PageHeader } from '../page-header';
import { PaginationBar } from '../pagination-bar';
import { QueryError, TableSkeleton } from '../query-states';
import { useAgencyFormat } from '../use-agency-format';
import { useUrlState } from '../use-url-state';
import { useValidationMessage } from '../use-validation-message';

const AGENCY_WIDE = 'agency';

const formSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    amount: z
      .string()
      .trim()
      .min(1, { message: 'REQUIRED' })
      .refine(
        (value) => {
          const millimes = parseDinars(value);
          return millimes !== null && millimes > 0 && millimes <= EXPENSE_AMOUNT_MAX_MILLIMES;
        },
        { message: 'INVALID_AMOUNT' },
      ),
    spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'INVALID_DATE' }),
    vehicleId: z.string().min(1),
    note: z.string().trim().max(EXPENSE_NOTE_MAX, { message: 'TOO_LONG' }),
  })
  .refine((value) => value.category !== 'OTHER' || value.note.length >= 3, {
    path: ['note'],
    message: 'REQUIRED',
  })
  .refine((value) => value.spentOn <= todayKey(), { path: ['spentOn'], message: 'FUTURE_DATE' });

type FormValues = z.input<typeof formSchema>;

function currentMonth(): string {
  return todayKey().slice(0, 7);
}

function isExpenseCategory(value: string): value is ExpenseCategory | 'ALL' {
  return value === 'ALL' || (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

const URL_DEFAULTS = { month: currentMonth(), category: 'ALL', vehicle: 'ALL', page: '1' };

function isValidParam(key: keyof typeof URL_DEFAULTS, value: string): boolean {
  switch (key) {
    case 'month':
      return /^\d{4}-\d{2}$/.test(value) && value <= currentMonth();
    case 'category':
      return isExpenseCategory(value);
    case 'vehicle':
      return value === 'ALL' || value.length > 0;
    case 'page':
      return /^\d+$/.test(value);
  }
}

function vehicleLabel(vehicle: {
  brand: string;
  model: string;
  plateNumber: string | null;
}): string {
  return vehicle.plateNumber === null
    ? `${vehicle.brand} ${vehicle.model}`
    : `${vehicle.brand} ${vehicle.model} · ${vehicle.plateNumber}`;
}

function ExpenseForm({ expense, onDone }: { expense: ExpenseView | null; onDone: () => void }) {
  const t = useTranslations('agency.expenses');
  const message = useValidationMessage();
  const vehicles = useVehicles();
  const save = useSaveExpense();
  const idPrefix = 'expense';
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: expense?.category ?? 'FUEL',
      amount: expense === null ? '' : millimesToDinarInput(expense.amountMillimes),
      spentOn: expense?.spentOn ?? todayKey(),
      vehicleId: expense?.vehicle?.id ?? AGENCY_WIDE,
      note: expense?.note ?? '',
    },
  });
  const category = useWatch({ control: form.control, name: 'category' });
  const knownVehicles = vehicles.data ?? [];
  const extra =
    expense?.vehicle !== null &&
    expense?.vehicle !== undefined &&
    !knownVehicles.some((vehicle) => vehicle.id === expense.vehicle?.id)
      ? [expense.vehicle]
      : [];

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          const amountMillimes = parseDinars(values.amount);
          if (amountMillimes === null) {
            return;
          }
          save.mutate(
            {
              ...(expense === null ? {} : { id: expense.id }),
              input: {
                category: values.category,
                amountMillimes,
                spentOn: values.spentOn,
                vehicleId: values.vehicleId === AGENCY_WIDE ? null : values.vehicleId,
                note: values.note.trim(),
              },
            },
            {
              onSuccess: () => {
                toast.success(expense === null ? t('saved') : t('updated'));
                onDone();
              },
              onError: (error) => {
                toast.error(error instanceof ApiError ? error.message : t('error'));
              },
            },
          );
        })(event);
      }}
    >
      <Controller
        control={form.control}
        name="category"
        render={({ field, fieldState }) => (
          <Field
            id={`${idPrefix}-category`}
            label={t('form.category')}
            hint={t(`categoryHints.${field.value}`)}
            error={message(fieldState.error?.message)}
            requiredIndicator="*"
          >
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                {...controlProps(`${idPrefix}-category`, {
                  error: fieldState.error?.message,
                  hint: t(`categoryHints.${field.value}`),
                })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`categories.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />
      <Field
        id={`${idPrefix}-amount`}
        label={t('form.amount')}
        hint={t('form.amountHint')}
        error={message(form.formState.errors.amount?.message)}
        requiredIndicator="*"
      >
        <Input
          inputMode="decimal"
          {...controlProps(`${idPrefix}-amount`, {
            error: form.formState.errors.amount?.message,
            hint: t('form.amountHint'),
          })}
          {...form.register('amount')}
        />
      </Field>
      <Field
        id={`${idPrefix}-date`}
        label={t('form.date')}
        error={message(form.formState.errors.spentOn?.message)}
        requiredIndicator="*"
      >
        <Input
          type="date"
          max={todayKey()}
          {...controlProps(`${idPrefix}-date`, { error: form.formState.errors.spentOn?.message })}
          {...form.register('spentOn')}
        />
      </Field>
      <Controller
        control={form.control}
        name="vehicleId"
        render={({ field, fieldState }) => (
          <Field
            id={`${idPrefix}-vehicle`}
            label={t('form.vehicle')}
            hint={t('vehicleHint')}
            error={message(fieldState.error?.message)}
          >
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                {...controlProps(`${idPrefix}-vehicle`, {
                  error: fieldState.error?.message,
                  hint: t('vehicleHint'),
                })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AGENCY_WIDE}>{t('vehicleAgency')}</SelectItem>
                {[...extra, ...knownVehicles].map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicleLabel(vehicle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />
      <Field
        id={`${idPrefix}-note`}
        label={t('form.note')}
        hint={category === 'OTHER' ? t('form.noteHint') : undefined}
        error={message(form.formState.errors.note?.message)}
        requiredIndicator={category === 'OTHER' ? '*' : undefined}
      >
        <Textarea
          rows={3}
          {...controlProps(`${idPrefix}-note`, {
            error: form.formState.errors.note?.message,
            hint: category === 'OTHER' ? t('form.noteHint') : undefined,
          })}
          {...form.register('note')}
        />
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            {t('form.cancel')}
          </Button>
        </DialogClose>
        <Button type="submit" loading={save.isPending}>
          {t('form.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ExpenseActions({
  expense,
  onEdit,
  onDelete,
}: {
  expense: ExpenseView;
  onEdit: (expense: ExpenseView) => void;
  onDelete: (expense: ExpenseView) => void;
}) {
  const t = useTranslations('agency.expenses');
  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('edit')}
        onClick={() => {
          onEdit(expense);
        }}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('remove')}
        onClick={() => {
          onDelete(expense);
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

export function ExpensesView() {
  const t = useTranslations('agency.expenses');
  const format = useAgencyFormat();
  const vehicles = useVehicles();
  const remove = useDeleteExpense();
  const [params, setParams] = useUrlState(URL_DEFAULTS, isValidParam);
  const [formExpense, setFormExpense] = useState<ExpenseView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ExpenseView | null>(null);
  const category = isExpenseCategory(params.category) ? params.category : 'ALL';
  const query: ExpenseQuery = {
    month: params.month,
    category,
    page: Number(params.page),
    limit: 20,
    ...(params.vehicle === 'ALL' ? {} : { vehicleId: params.vehicle }),
  };
  const list = useExpenses(query);
  const month = params.month;
  const atCurrent = month >= currentMonth();
  const filtered = category !== 'ALL' || params.vehicle !== 'ALL';
  const openEdit = (expense: ExpenseView) => {
    setFormExpense(expense);
    setFormOpen(true);
  };

  const openCreate = () => {
    setFormExpense(null);
    setFormOpen(true);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t('add')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-control border border-border bg-surface">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('previous')}
            onClick={() => {
              setParams({ month: addMonths(month, -1), page: '1' });
            }}
          >
            <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="border-x border-border"
            disabled={atCurrent}
            onClick={() => {
              setParams({ month: currentMonth(), page: '1' });
            }}
          >
            {t('currentMonth')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('next')}
            disabled={atCurrent}
            onClick={() => {
              setParams({ month: addMonths(month, 1), page: '1' });
            }}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm font-semibold capitalize">
          {format.monthLong(`${month}-15T12:00:00Z`)}
        </p>
      </div>

      {list.data !== undefined && (
        <div className="grid gap-3">
          <Card className="flex flex-wrap items-end justify-between gap-2 p-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('total')}</p>
              <p className="font-heading text-2xl font-bold tabular-nums">
                {format.money(list.data.totalMillimes)}
              </p>
            </div>
          </Card>
          <FilterTabs
            label={t('filterLabel')}
            value={category}
            options={[
              { value: 'ALL' as const, label: t('all') },
              ...EXPENSE_CATEGORIES.filter(
                (value) =>
                  value === category || list.data.byCategory.some((row) => row.category === value),
              ).map((value) => {
                const amount = list.data.byCategory.find(
                  (row) => row.category === value,
                )?.amountMillimes;
                const name = t(`categories.${value}`);
                return {
                  value,
                  label: amount === undefined ? name : `${name} · ${format.money(amount)}`,
                  hint: t(`categoryHints.${value}`),
                };
              }),
            ]}
            onValueChange={(value) => {
              setParams({ category: value, page: '1' });
            }}
          />
        </div>
      )}

      <Field id="expense-vehicle-filter" label={t('vehicleLabel')}>
        <Select
          value={params.vehicle}
          onValueChange={(value) => {
            setParams({ vehicle: value, page: '1' });
          }}
        >
          <SelectTrigger {...controlProps('expense-vehicle-filter', {})}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('vehicleAll')}</SelectItem>
            {(vehicles.data ?? []).map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleLabel(vehicle)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {list.isPending ? (
        <TableSkeleton />
      ) : list.isError ? (
        <QueryError
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
          retrying={list.isFetching}
        />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtered ? t('emptyFilteredTitle') : t('emptyTitle')}
          description={filtered ? t('emptyFilteredText') : t('emptyText')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filtered && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setParams({ category: 'ALL', vehicle: 'ALL', page: '1' });
                  }}
                >
                  {t('clearFilters')}
                </Button>
              )}
              <Button type="button" onClick={openCreate}>
                <Plus aria-hidden="true" />
                {t('add')}
              </Button>
            </div>
          }
        />
      ) : (
        <div
          className={cn('grid gap-4 transition-opacity', list.isPlaceholderData && 'opacity-60')}
          aria-busy={list.isPlaceholderData}
        >
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.date')}</TableHead>
                  <TableHead>{t('columns.category')}</TableHead>
                  <TableHead>{t('columns.vehicle')}</TableHead>
                  <TableHead>{t('columns.note')}</TableHead>
                  <TableHead className="text-end">{t('columns.amount')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('columns.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {format.date(`${expense.spentOn}T12:00:00Z`)}
                    </TableCell>
                    <TableCell>{t(`categories.${expense.category}`)}</TableCell>
                    <TableCell>
                      {expense.vehicle === null ? t('agencyWide') : vehicleLabel(expense.vehicle)}
                    </TableCell>
                    <TableCell
                      className="max-w-56 truncate text-muted-foreground"
                      title={expense.note}
                    >
                      {expense.note === '' ? '—' : expense.note}
                    </TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {format.money(expense.amountMillimes)}
                    </TableCell>
                    <TableCell>
                      <ExpenseActions
                        expense={expense}
                        onEdit={openEdit}
                        onDelete={setPendingDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {list.data.items.map((expense) => (
              <li key={expense.id}>
                <Card className="grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{t(`categories.${expense.category}`)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format.date(`${expense.spentOn}T12:00:00Z`)}
                        {' · '}
                        {expense.vehicle === null ? t('agencyWide') : vehicleLabel(expense.vehicle)}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">
                      {format.money(expense.amountMillimes)}
                    </p>
                  </div>
                  {expense.note !== '' && (
                    <p className="text-sm text-muted-foreground">{expense.note}</p>
                  )}
                  <ExpenseActions expense={expense} onEdit={openEdit} onDelete={setPendingDelete} />
                </Card>
              </li>
            ))}
          </ul>
          <PaginationBar
            data={list.data}
            onPageChange={(page) => {
              setParams({ page: String(page) });
            }}
          />
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formExpense === null ? t('form.createTitle') : t('form.editTitle')}
            </DialogTitle>
            <DialogDescription>{t('form.description')}</DialogDescription>
          </DialogHeader>
          {formOpen ? (
            <ExpenseForm
              key={formExpense?.id ?? 'new'}
              expense={formExpense}
              onDone={() => {
                setFormOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('delete.title')}
        description={
          pendingDelete === null
            ? ''
            : t('delete.text', {
                category: t(`categories.${pendingDelete.category}`),
                date: format.date(pendingDelete.spentOn),
                amount: format.money(pendingDelete.amountMillimes),
              })
        }
        confirmLabel={t('delete.confirm')}
        dismissLabel={t('delete.dismiss')}
        closeLabel={t('delete.close')}
        destructive
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete === null) {
            return;
          }
          remove.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success(t('deleted'));
              setPendingDelete(null);
            },
            onError: (error) => {
              toast.error(error instanceof ApiError ? error.message : t('error'));
            },
          });
        }}
      />
    </div>
  );
}
