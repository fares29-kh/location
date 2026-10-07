import { Module } from '@nestjs/common';

import { BookingsController, OffersController } from './bookings.controller';
import { CustomerBookingsService } from './customer-bookings.service';
import { OffersService } from './offers.service';

@Module({
  controllers: [OffersController, BookingsController],
  providers: [OffersService, CustomerBookingsService],
})
export class BookingsModule {}
