import {
  addMonths,
  type ExpenseList,
  type ExpenseQuery,
  type ExpenseRequest,
  type ExpenseView,
  todayKey,
} from '@drivetn/types';
import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { ExpenseCategory, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyService } from './agency.service';

function spentOnDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function dayOf(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agency: AgencyService,
    private readonly audit: AuditService,
  ) {}

  async list(ownerId: string, query: ExpenseQuery): Promise<ExpenseList> {
    const agencyId = await this.agency.agencyIdFor(ownerId);
    const month = this.monthOf(query.month);
    const where = this.where(agencyId, month, query);
    const [count, grouped, rows] = await this.prisma.$transaction([
      this.prisma.agencyExpense.count({ where }),
      this.prisma.agencyExpense.groupBy({
        by: ['category'],
        where: this.where(agencyId, month, { ...query, category: 'ALL' }),
        _sum: { amountMillimes: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.agencyExpense.findMany({
        where,
        include: { vehicle: { select: vehicleSelect } },
        orderBy: [{ spentOn: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const byCategory = grouped
      .map((row) => ({
        category: row.category,
        amountMillimes: row._sum?.amountMillimes ?? 0,
      }))
      .filter((row) => row.amountMillimes > 0);
    const totalMillimes = byCategory.reduce((sum, row) => sum + row.amountMillimes, 0);
    return {
      month,
      totalMillimes,
      byCategory,
      items: rows.map(toView),
      total: count,
      page: query.page,
      pageSize: query.limit,
      pageCount: pageCount(count, query.limit),
    };
  }

  async create(ownerId: string, input: ExpenseRequest, ip: string | null): Promise<ExpenseView> {
    const agencyId = await this.agency.agencyIdFor(ownerId);
    this.assertDay(input.spentOn);
    await this.assertVehicle(agencyId, input.vehicleId);
    const created = await this.prisma.agencyExpense.create({
      data: this.data(agencyId, input),
      include: { vehicle: { select: vehicleSelect } },
    });
    await this.audit.log({
      action: 'expense.created',
      actorId: ownerId,
      entityType: 'expense',
      entityId: created.id,
      metadata: { category: created.category, amountMillimes: created.amountMillimes },
      ip,
    });
    return toView(created);
  }

  async update(
    ownerId: string,
    expenseId: string,
    input: ExpenseRequest,
    ip: string | null,
  ): Promise<ExpenseView> {
    const agencyId = await this.agency.agencyIdFor(ownerId);
    this.assertDay(input.spentOn);
    await this.assertVehicle(agencyId, input.vehicleId);
    await this.owned(agencyId, expenseId);
    const updated = await this.prisma.agencyExpense.update({
      where: { id: expenseId },
      data: {
        category: input.category,
        amountMillimes: input.amountMillimes,
        spentOn: spentOnDate(input.spentOn),
        vehicleId: input.vehicleId,
        note: input.note,
      },
      include: { vehicle: { select: vehicleSelect } },
    });
    await this.audit.log({
      action: 'expense.updated',
      actorId: ownerId,
      entityType: 'expense',
      entityId: updated.id,
      metadata: { category: updated.category, amountMillimes: updated.amountMillimes },
      ip,
    });
    return toView(updated);
  }

  async remove(ownerId: string, expenseId: string, ip: string | null): Promise<void> {
    const agencyId = await this.agency.agencyIdFor(ownerId);
    const existing = await this.owned(agencyId, expenseId);
    await this.prisma.agencyExpense.delete({ where: { id: expenseId } });
    await this.audit.log({
      action: 'expense.deleted',
      actorId: ownerId,
      entityType: 'expense',
      entityId: expenseId,
      metadata: { category: existing.category, amountMillimes: existing.amountMillimes },
      ip,
    });
  }

  private monthOf(month: string | undefined): string {
    const current = todayKey().slice(0, 7);
    if (month === undefined || month > current) {
      return current;
    }
    return month;
  }

  private where(
    agencyId: string,
    month: string,
    query: Pick<ExpenseQuery, 'category' | 'vehicleId'>,
  ): Prisma.AgencyExpenseWhereInput {
    return {
      agencyId,
      spentOn: {
        gte: spentOnDate(`${month}-01`),
        lt: spentOnDate(`${addMonths(month, 1)}-01`),
      },
      ...(query.category === 'ALL' ? {} : { category: query.category }),
      ...(query.vehicleId === undefined ? {} : { vehicleId: query.vehicleId }),
    };
  }

  private assertDay(day: string): void {
    if (day > todayKey()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Une dépense ne peut pas être datée dans le futur.',
        [{ path: 'spentOn', message: 'FUTURE_DATE' }],
      );
    }
  }

  private async assertVehicle(agencyId: string, vehicleId: string | null): Promise<void> {
    if (vehicleId === null) {
      return;
    }
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, agencyId },
      select: { id: true },
    });
    if (vehicle === null) {
      throw new NotFoundException('Véhicule introuvable.');
    }
  }

  private async owned(agencyId: string, expenseId: string) {
    const expense = await this.prisma.agencyExpense.findFirst({
      where: { id: expenseId, agencyId },
      select: { id: true, category: true, amountMillimes: true },
    });
    if (expense === null) {
      throw new NotFoundException('Dépense introuvable.');
    }
    return expense;
  }

  private data(agencyId: string, input: ExpenseRequest): Prisma.AgencyExpenseUncheckedCreateInput {
    return {
      agencyId,
      vehicleId: input.vehicleId,
      category: input.category,
      amountMillimes: input.amountMillimes,
      spentOn: spentOnDate(input.spentOn),
      note: input.note,
    };
  }
}

const vehicleSelect = {
  id: true,
  brand: true,
  model: true,
  plateNumber: true,
  retiredPlateNumber: true,
} as const;

function toView(row: {
  id: string;
  category: ExpenseCategory;
  amountMillimes: number;
  spentOn: Date;
  note: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    plateNumber: string | null;
    retiredPlateNumber: string | null;
  } | null;
}): ExpenseView {
  return {
    id: row.id,
    category: row.category,
    amountMillimes: row.amountMillimes,
    spentOn: dayOf(row.spentOn),
    note: row.note,
    vehicle:
      row.vehicle === null
        ? null
        : {
            id: row.vehicle.id,
            brand: row.vehicle.brand,
            model: row.vehicle.model,
            plateNumber: row.vehicle.plateNumber ?? row.vehicle.retiredPlateNumber,
          },
  };
}
