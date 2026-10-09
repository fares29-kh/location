import type { VehicleBrandInfo, VehicleCategoryInfo } from '@drivetn/types';
import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/auth/decorators';
import { CatalogService } from './catalog.service';

const PUBLIC_CACHE = 'public, max-age=60';

@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Catégories de véhicules, dans l’ordre d’affichage' })
  categories(): Promise<VehicleCategoryInfo[]> {
    return this.catalog.categories();
  }

  @Get('brands')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Marques de véhicules et leurs modèles, proposés aux agences' })
  brands(): Promise<VehicleBrandInfo[]> {
    return this.catalog.brands();
  }
}
