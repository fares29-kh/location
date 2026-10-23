import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module';
import { AgencyController } from './agency.controller';
import { AgencyService } from './agency.service';
import { ExpensesService } from './expenses.service';
import { VehiclePhotosService } from './vehicle-photos.service';

@Module({
  imports: [CatalogModule],
  controllers: [AgencyController],
  providers: [AgencyService, ExpensesService, VehiclePhotosService],
})
export class AgencyModule {}
