import {
  type AdminDelegation,
  type AdminGovernorate,
  type AdminMunicipality,
  type AdminVehicleBrand,
  type AdminVehicleCategory,
  type AdminVehicleModel,
  type DelegationInput,
  delegationInputSchema,
  type DelegationQuery,
  delegationQuerySchema,
  type DelegationUpdate,
  delegationUpdateSchema,
  type GovernorateInput,
  governorateInputSchema,
  type GovernorateUpdate,
  governorateUpdateSchema,
  type MunicipalityInput,
  municipalityInputSchema,
  type MunicipalityQuery,
  municipalityQuerySchema,
  type MunicipalityUpdate,
  municipalityUpdateSchema,
  type VehicleBrandInput,
  vehicleBrandInputSchema,
  type VehicleCategoryInput,
  vehicleCategoryInputSchema,
  type VehicleCategoryUpdate,
  vehicleCategoryUpdateSchema,
  type VehicleModelInput,
  vehicleModelInputSchema,
  type VehicleModelQuery,
  vehicleModelQuerySchema,
  type VehicleModelUpdate,
  vehicleModelUpdateSchema,
} from '@drivetn/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, RequireAdminPermission, Roles } from '../common/auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminGeographyService } from './admin-geography.service';

function actor(user: AuthenticatedUser, request: Request) {
  return { actorId: user.id, ip: request.ip ?? null };
}

/**
 * Référentiels de la plateforme : tous les administrateurs les consultent, seuls ceux qui ont
 * la permission `referentials.manage` les modifient.
 */
@ApiTags('admin')
@ApiCookieAuth()
@Roles('ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminReferentialsController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly geography: AdminGeographyService,
  ) {}

  // --- Catégories de véhicules -------------------------------------------------------------

  @Get('vehicle-categories')
  @ApiOperation({ summary: 'Catégories de véhicules et nombre de véhicules rattachés' })
  listCategories(): Promise<AdminVehicleCategory[]> {
    return this.catalog.listCategories();
  }

  @Post('vehicle-categories')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Ajouter une catégorie de véhicules' })
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(vehicleCategoryInputSchema)) body: VehicleCategoryInput,
    @Req() request: Request,
  ): Promise<AdminVehicleCategory> {
    return this.catalog.createCategory(body, actor(user, request));
  }

  @Put('vehicle-categories/:id')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Modifier une catégorie (le slug reste inchangé)' })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleCategoryUpdateSchema)) body: VehicleCategoryUpdate,
    @Req() request: Request,
  ): Promise<AdminVehicleCategory> {
    return this.catalog.updateCategory(id, body, actor(user, request));
  }

  @Delete('vehicle-categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Supprimer une catégorie inutilisée' })
  deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.catalog.deleteCategory(id, actor(user, request));
  }

  // --- Marques ----------------------------------------------------------------------------

  @Get('vehicle-brands')
  @ApiOperation({ summary: 'Marques de véhicules, nombre de modèles et de véhicules rattachés' })
  listBrands(): Promise<AdminVehicleBrand[]> {
    return this.catalog.listBrands();
  }

  @Post('vehicle-brands')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Ajouter une marque' })
  createBrand(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(vehicleBrandInputSchema)) body: VehicleBrandInput,
    @Req() request: Request,
  ): Promise<AdminVehicleBrand> {
    return this.catalog.createBrand(body, actor(user, request));
  }

  @Put('vehicle-brands/:id')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Renommer une marque (et les véhicules qui la portent)' })
  updateBrand(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleBrandInputSchema)) body: VehicleBrandInput,
    @Req() request: Request,
  ): Promise<AdminVehicleBrand> {
    return this.catalog.updateBrand(id, body, actor(user, request));
  }

  @Delete('vehicle-brands/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Supprimer une marque inutilisée' })
  deleteBrand(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.catalog.deleteBrand(id, actor(user, request));
  }

  // --- Modèles ----------------------------------------------------------------------------

  @Get('vehicle-models')
  @ApiOperation({ summary: 'Modèles d’une marque et nombre de véhicules rattachés' })
  listModels(
    @Query(new ZodValidationPipe(vehicleModelQuerySchema)) query: VehicleModelQuery,
  ): Promise<AdminVehicleModel[]> {
    return this.catalog.listModels(query.brand);
  }

  @Post('vehicle-models')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Ajouter un modèle à une marque' })
  createModel(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(vehicleModelInputSchema)) body: VehicleModelInput,
    @Req() request: Request,
  ): Promise<AdminVehicleModel> {
    return this.catalog.createModel(body, actor(user, request));
  }

  @Put('vehicle-models/:id')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Renommer un modèle (et les véhicules qui le portent)' })
  updateModel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleModelUpdateSchema)) body: VehicleModelUpdate,
    @Req() request: Request,
  ): Promise<AdminVehicleModel> {
    return this.catalog.updateModel(id, body, actor(user, request));
  }

  @Delete('vehicle-models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Supprimer un modèle inutilisé' })
  deleteModel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.catalog.deleteModel(id, actor(user, request));
  }

  // --- Gouvernorats -----------------------------------------------------------------------

  @Get('governorates')
  @ApiOperation({ summary: 'Gouvernorats et éléments rattachés' })
  listGovernorates(): Promise<AdminGovernorate[]> {
    return this.geography.listGovernorates();
  }

  @Post('governorates')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Ajouter un gouvernorat' })
  createGovernorate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(governorateInputSchema)) body: GovernorateInput,
    @Req() request: Request,
  ): Promise<AdminGovernorate> {
    return this.geography.createGovernorate(body, actor(user, request));
  }

  @Put('governorates/:code')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Modifier un gouvernorat (le code reste inchangé)' })
  updateGovernorate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body(new ZodValidationPipe(governorateUpdateSchema)) body: GovernorateUpdate,
    @Req() request: Request,
  ): Promise<AdminGovernorate> {
    return this.geography.updateGovernorate(code, body, actor(user, request));
  }

  @Delete('governorates/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Supprimer un gouvernorat sans agence, lieu ni délégation' })
  deleteGovernorate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.geography.deleteGovernorate(code, actor(user, request));
  }

  // --- Délégations ------------------------------------------------------------------------

  @Get('delegations')
  @ApiOperation({ summary: 'Délégations d’un gouvernorat' })
  listDelegations(
    @Query(new ZodValidationPipe(delegationQuerySchema)) query: DelegationQuery,
  ): Promise<AdminDelegation[]> {
    return this.geography.listDelegations(query.governorate);
  }

  @Post('delegations')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Ajouter une délégation' })
  createDelegation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(delegationInputSchema)) body: DelegationInput,
    @Req() request: Request,
  ): Promise<AdminDelegation> {
    return this.geography.createDelegation(body, actor(user, request));
  }

  @Put('delegations/:id')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Renommer une délégation' })
  updateDelegation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(delegationUpdateSchema)) body: DelegationUpdate,
    @Req() request: Request,
  ): Promise<AdminDelegation> {
    return this.geography.updateDelegation(id, body, actor(user, request));
  }

  @Delete('delegations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Supprimer une délégation sans municipalité' })
  deleteDelegation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.geography.deleteDelegation(id, actor(user, request));
  }

  // --- Municipalités ----------------------------------------------------------------------

  @Get('municipalities')
  @ApiOperation({ summary: 'Municipalités d’une délégation' })
  listMunicipalities(
    @Query(new ZodValidationPipe(municipalityQuerySchema)) query: MunicipalityQuery,
  ): Promise<AdminMunicipality[]> {
    return this.geography.listMunicipalities(query.delegation);
  }

  @Post('municipalities')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Ajouter une municipalité' })
  createMunicipality(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(municipalityInputSchema)) body: MunicipalityInput,
    @Req() request: Request,
  ): Promise<AdminMunicipality> {
    return this.geography.createMunicipality(body, actor(user, request));
  }

  @Put('municipalities/:id')
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Renommer une municipalité' })
  updateMunicipality(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(municipalityUpdateSchema)) body: MunicipalityUpdate,
    @Req() request: Request,
  ): Promise<AdminMunicipality> {
    return this.geography.updateMunicipality(id, body, actor(user, request));
  }

  @Delete('municipalities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAdminPermission('referentials.manage')
  @ApiOperation({ summary: 'Supprimer une municipalité' })
  deleteMunicipality(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.geography.deleteMunicipality(id, actor(user, request));
  }
}
