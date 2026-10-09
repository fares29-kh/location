import { Module } from '@nestjs/common';

import { AgencyDirectoryService } from './agency-directory.service';
import {
  AgencyDirectoryController,
  BookingsController,
  OffersController,
} from './bookings.controller';
import { CustomerBookingsService } from './customer-bookings.service';
import { OffersService } from './offers.service';

@Module({
  controllers: [OffersController, AgencyDirectoryController, BookingsController],
  providers: [OffersService, AgencyDirectoryService, CustomerBookingsService],
})
export class BookingsModule {}
