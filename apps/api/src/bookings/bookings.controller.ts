import {
  type CancelBookingInput,
  cancelBookingSchema,
  type CreateBookingInput,
  createBookingSchema,
  type CustomerBooking,
  type OfferSearch,
  offerSearchSchema,
  type OfferSearchResult,
} from '@drivetn/types';
import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Public, Roles } from '../common/auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { CustomerBookingsService } from './customer-bookings.service';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Public()
@Controller({ path: 'offers', version: '1' })
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Véhicules disponibles (lieu, dates, catégorie)' })
  search(
    @Query(new ZodValidationPipe(offerSearchSchema)) query: OfferSearch,
  ): Promise<OfferSearchResult> {
    return this.offers.search(query);
  }
}

@ApiTags('bookings')
@ApiCookieAuth()
@Roles('CUSTOMER')
@Controller({ path: 'bookings', version: '1' })
export class BookingsController {
  constructor(private readonly bookings: CustomerBookingsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Réservations du client connecté' })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<CustomerBooking[]> {
    return this.bookings.list(user.id);
  }

  @Post()
  @RateLimit({ name: 'create-booking', limit: 10, windowSeconds: 60 * 60 })
  @ApiOperation({ summary: 'Envoyer une demande de réservation (sans paiement en ligne)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput,
    @Req() request: Request,
  ): Promise<CustomerBooking> {
    return this.bookings.create(user.id, body, request.ip ?? null);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Annuler une demande ou une réservation à venir' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelBookingSchema)) body: CancelBookingInput,
    @Req() request: Request,
  ): Promise<CustomerBooking> {
    return this.bookings.cancel(user.id, id, body, request.ip ?? null);
  }
}
