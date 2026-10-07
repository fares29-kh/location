import {
  type Governorate,
  LOCATION_TYPES,
  type LocationQuery,
  locationQuerySchema,
  type PickupLocation,
} from '@drivetn/types';
import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GovernorateDto, PickupLocationDto } from './locations.dto';
import { LocationsService } from './locations.service';

const PUBLIC_CACHE = 'public, max-age=300';

@ApiTags('locations')
@Public()
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('governorates')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Les 24 gouvernorats tunisiens' })
  @ApiOkResponse({ type: GovernorateDto, isArray: true })
  governorates(): Promise<Governorate[]> {
    return this.locations.governorates();
  }

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Lieux de prise en charge (aéroports, villes, gares, ports)' })
  @ApiQuery({ name: 'type', required: false, enum: LOCATION_TYPES })
  @ApiQuery({ name: 'governorate', required: false, description: 'Code à 2 chiffres' })
  @ApiOkResponse({ type: PickupLocationDto, isArray: true })
  list(
    @Query(new ZodValidationPipe(locationQuerySchema)) query: LocationQuery,
  ): Promise<PickupLocation[]> {
    return this.locations.locations(query);
  }
}
