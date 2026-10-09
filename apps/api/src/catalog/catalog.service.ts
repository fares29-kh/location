import {
  matchVehicleBrand,
  matchVehicleModel,
  type VehicleBrandInfo,
  type VehicleCategoryInfo,
  type VehicleInput,
} from '@drivetn/types';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../common/errors/app.exception';
import type { ValidationIssue } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORY_ORDER, compareNames, toBrandInfo, toCategoryInfo } from './catalog.mapper';

/** Saisie d'un véhicule rattachée aux référentiels : marque et modèle canoniques, catégorie par clé. */
export type ResolvedVehicleInput = Omit<VehicleInput, 'category'> & { categoryId: string };

/** Catégories, marques et modèles de véhicules, tels que gérés par l'administration. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async categories(): Promise<VehicleCategoryInfo[]> {
    const rows = await this.prisma.vehicleCategory.findMany({ orderBy: [...CATEGORY_ORDER] });
    return rows.map(toCategoryInfo);
  }

  async brands(): Promise<VehicleBrandInfo[]> {
    const rows = await this.prisma.vehicleBrand.findMany({
      include: { models: { select: { name: true } } },
    });
    return rows.map(toBrandInfo).sort((a, b) => compareNames(a.name, b.name));
  }

  /**
   * Vérifie la marque, son modèle et la catégorie d'un véhicule ; renvoie la marque et le
   * modèle sous leur nom officiel.
   */
  async resolveVehicleInput(input: VehicleInput): Promise<ResolvedVehicleInput> {
    const [brands, category] = await Promise.all([
      this.prisma.vehicleBrand.findMany({
        select: { name: true, models: { select: { name: true } } },
      }),
      this.prisma.vehicleCategory.findUnique({
        where: { slug: input.category },
        select: { id: true },
      }),
    ]);
    const brand = matchVehicleBrand(
      input.brand,
      brands.map((row) => row.name),
    );
    const models = brands.find((row) => row.name === brand)?.models ?? [];
    const model =
      brand === null
        ? null
        : matchVehicleModel(
            input.model,
            models.map((row) => row.name),
          );
    const issues: ValidationIssue[] = [
      ...(brand === null ? [{ path: 'brand', message: 'INVALID_BRAND' }] : []),
      ...(brand !== null && model === null ? [{ path: 'model', message: 'INVALID_MODEL' }] : []),
      ...(category === null ? [{ path: 'category', message: 'INVALID_CATEGORY' }] : []),
    ];
    if (brand === null || model === null || category === null) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Données invalides.',
        issues,
      );
    }
    const { category: _slug, ...rest } = input;
    return { ...rest, brand, model, categoryId: category.id };
  }
}
