import {
  type AdminVehicleBrand,
  type AdminVehicleCategory,
  type AdminVehicleModel,
  type AuditAction,
  type VehicleBrandInput,
  vehicleBrandKey,
  type VehicleCategoryInput,
  type VehicleCategoryUpdate,
  type VehicleModelInput,
  type VehicleModelUpdate,
} from '@drivetn/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { VehicleModel } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CATEGORY_ORDER, compareNames, toCategoryInfo } from '../catalog/catalog.mapper';
import { PrismaService } from '../prisma/prisma.service';
import {
  alreadyUsed,
  auditLabel,
  inUse,
  isUniqueViolation,
  nameColumns,
} from './referentials.utils';

interface Actor {
  actorId: string;
  ip: string | null;
}

/** Référentiel des catégories, marques et modèles de véhicules. */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Catégories ----------------------------------------------------------------------

  async listCategories(): Promise<AdminVehicleCategory[]> {
    const rows = await this.prisma.vehicleCategory.findMany({
      include: { _count: { select: { vehicles: true } } },
      orderBy: [...CATEGORY_ORDER],
    });
    return rows.map((row) => ({ ...toCategoryInfo(row), vehiclesCount: row._count.vehicles }));
  }

  async createCategory(input: VehicleCategoryInput, actor: Actor): Promise<AdminVehicleCategory> {
    try {
      const row = await this.prisma.vehicleCategory.create({
        data: { slug: input.slug, position: input.position, ...categoryColumns(input) },
      });
      await this.log('referential.created', auditLabel('Catégorie', row.nameFr), actor);
      return { ...toCategoryInfo(row), vehiclesCount: 0 };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('slug');
      }
      throw error;
    }
  }

  async updateCategory(
    id: string,
    input: VehicleCategoryUpdate,
    actor: Actor,
  ): Promise<AdminVehicleCategory> {
    const before = await this.prisma.vehicleCategory.findUnique({ where: { id } });
    if (before === null) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    const row = await this.prisma.vehicleCategory.update({
      where: { id },
      data: { position: input.position, ...categoryColumns(input) },
      include: { _count: { select: { vehicles: true } } },
    });
    await this.log(
      'referential.updated',
      auditLabel('Catégorie', row.nameFr, before.nameFr),
      actor,
    );
    return { ...toCategoryInfo(row), vehiclesCount: row._count.vehicles };
  }

  async deleteCategory(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.vehicleCategory.findUnique({
      where: { id },
      include: { _count: { select: { vehicles: true } } },
    });
    if (row === null) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    if (row._count.vehicles > 0) {
      throw inUse('Des véhicules utilisent encore cette catégorie.');
    }
    await this.prisma.vehicleCategory.delete({ where: { id } });
    await this.log('referential.deleted', auditLabel('Catégorie', row.nameFr), actor);
  }

  // --- Marques ------------------------------------------------------------------------

  async listBrands(): Promise<AdminVehicleBrand[]> {
    const [rows, usage] = await Promise.all([
      this.prisma.vehicleBrand.findMany({ include: { _count: { select: { models: true } } } }),
      this.prisma.vehicle.groupBy({ by: ['brand'], _count: { _all: true } }),
    ]);
    const countByBrand = new Map(usage.map((group) => [group.brand, group._count._all]));
    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        modelsCount: row._count.models,
        vehiclesCount: countByBrand.get(row.name) ?? 0,
      }))
      .sort((a, b) => compareNames(a.name, b.name));
  }

  async createBrand(input: VehicleBrandInput, actor: Actor): Promise<AdminVehicleBrand> {
    await this.assertBrandAvailable(input.name);
    try {
      const row = await this.prisma.vehicleBrand.create({ data: { name: input.name } });
      await this.log('referential.created', auditLabel('Marque', row.name), actor);
      return { id: row.id, name: row.name, modelsCount: 0, vehiclesCount: 0 };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name');
      }
      throw error;
    }
  }

  /** Le nom est recopié sur les véhicules : un renommage les met à jour dans la même transaction. */
  async updateBrand(
    id: string,
    input: VehicleBrandInput,
    actor: Actor,
  ): Promise<AdminVehicleBrand> {
    const before = await this.prisma.vehicleBrand.findUnique({ where: { id } });
    if (before === null) {
      throw new NotFoundException('Marque introuvable.');
    }
    await this.assertBrandAvailable(input.name, id);
    try {
      const [row, renamed] = await this.prisma.$transaction([
        this.prisma.vehicleBrand.update({
          where: { id },
          data: { name: input.name },
          include: { _count: { select: { models: true } } },
        }),
        this.prisma.vehicle.updateMany({
          where: { brand: before.name },
          data: { brand: input.name },
        }),
      ]);
      await this.log('referential.updated', auditLabel('Marque', row.name, before.name), actor);
      return {
        id: row.id,
        name: row.name,
        modelsCount: row._count.models,
        vehiclesCount: renamed.count,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name');
      }
      throw error;
    }
  }

  async deleteBrand(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.vehicleBrand.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException('Marque introuvable.');
    }
    const vehicles = await this.prisma.vehicle.count({ where: { brand: row.name } });
    if (vehicles > 0) {
      throw inUse('Des véhicules utilisent encore cette marque.');
    }
    await this.prisma.vehicleBrand.delete({ where: { id } });
    await this.log('referential.deleted', auditLabel('Marque', row.name), actor);
  }

  /** « Mercedes Benz » et « mercedes-benz » désignent la même marque que « Mercedes-Benz ». */
  private async assertBrandAvailable(name: string, exceptId?: string): Promise<void> {
    const key = vehicleBrandKey(name);
    const brands = await this.prisma.vehicleBrand.findMany({ select: { id: true, name: true } });
    if (brands.some((brand) => brand.id !== exceptId && vehicleBrandKey(brand.name) === key)) {
      throw alreadyUsed('name');
    }
  }

  // --- Modèles ------------------------------------------------------------------------

  async listModels(brandId: string): Promise<AdminVehicleModel[]> {
    const brand = await this.findBrand(brandId);
    const [rows, usage] = await Promise.all([
      this.prisma.vehicleModel.findMany({ where: { brandId } }),
      this.prisma.vehicle.groupBy({
        by: ['model'],
        where: { brand: brand.name },
        _count: { _all: true },
      }),
    ]);
    const countByModel = new Map(usage.map((group) => [group.model, group._count._all]));
    return rows
      .map((row) => toAdminModel(row, countByModel.get(row.name) ?? 0))
      .sort((a, b) => compareNames(a.name, b.name));
  }

  async createModel(input: VehicleModelInput, actor: Actor): Promise<AdminVehicleModel> {
    const brand = await this.findBrand(input.brandId);
    await this.assertModelAvailable(brand.id, input.name);
    try {
      const row = await this.prisma.vehicleModel.create({
        data: { brandId: brand.id, name: input.name },
      });
      await this.log('referential.created', modelLabel(brand.name, row.name), actor);
      return toAdminModel(row, 0);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name');
      }
      throw error;
    }
  }

  /** Comme pour les marques, le renommage est recopié sur les véhicules de la marque. */
  async updateModel(
    id: string,
    input: VehicleModelUpdate,
    actor: Actor,
  ): Promise<AdminVehicleModel> {
    const before = await this.prisma.vehicleModel.findUnique({
      where: { id },
      include: { brand: { select: { name: true } } },
    });
    if (before === null) {
      throw new NotFoundException('Modèle introuvable.');
    }
    await this.assertModelAvailable(before.brandId, input.name, id);
    try {
      const [row, renamed] = await this.prisma.$transaction([
        this.prisma.vehicleModel.update({ where: { id }, data: { name: input.name } }),
        this.prisma.vehicle.updateMany({
          where: { brand: before.brand.name, model: before.name },
          data: { model: input.name },
        }),
      ]);
      await this.log(
        'referential.updated',
        modelLabel(before.brand.name, row.name, before.name),
        actor,
      );
      return toAdminModel(row, renamed.count);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw alreadyUsed('name');
      }
      throw error;
    }
  }

  async deleteModel(id: string, actor: Actor): Promise<void> {
    const row = await this.prisma.vehicleModel.findUnique({
      where: { id },
      include: { brand: { select: { name: true } } },
    });
    if (row === null) {
      throw new NotFoundException('Modèle introuvable.');
    }
    const vehicles = await this.prisma.vehicle.count({
      where: { brand: row.brand.name, model: row.name },
    });
    if (vehicles > 0) {
      throw inUse('Des véhicules utilisent encore ce modèle.');
    }
    await this.prisma.vehicleModel.delete({ where: { id } });
    await this.log('referential.deleted', modelLabel(row.brand.name, row.name), actor);
  }

  private async findBrand(id: string): Promise<{ id: string; name: string }> {
    const brand = await this.prisma.vehicleBrand.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (brand === null) {
      throw new NotFoundException('Marque introuvable.');
    }
    return brand;
  }

  /** « serie 3 » et « Série-3 » désignent le même modèle d'une marque. */
  private async assertModelAvailable(
    brandId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const key = vehicleBrandKey(name);
    const models = await this.prisma.vehicleModel.findMany({
      where: { brandId },
      select: { id: true, name: true },
    });
    if (models.some((model) => model.id !== exceptId && vehicleBrandKey(model.name) === key)) {
      throw alreadyUsed('name');
    }
  }

  private log(action: AuditAction, label: string, actor: Actor): Promise<void> {
    return this.audit.log({
      action,
      actorId: actor.actorId,
      metadata: { changes: label },
      ip: actor.ip,
    });
  }
}

function toAdminModel(row: VehicleModel, vehiclesCount: number): AdminVehicleModel {
  return { id: row.id, brandId: row.brandId, name: row.name, vehiclesCount };
}

function modelLabel(brand: string, name: string, previous?: string): string {
  return auditLabel(
    'Modèle',
    `${brand} ${name}`,
    previous === undefined ? undefined : `${brand} ${previous}`,
  );
}

function categoryColumns(input: VehicleCategoryUpdate) {
  return {
    ...nameColumns(input.name),
    descriptionFr: input.description.fr,
    descriptionAr: input.description.ar,
    descriptionEn: input.description.en,
  };
}
