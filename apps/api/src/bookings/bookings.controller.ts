import {
  type CancelBookingInput,
  cancelBookingSchema,
  type CreateBookingInput,
  createBookingSchema,
  type CreateReviewInput,
  createReviewSchema,
  type CustomerBooking,
  type OfferSearch,
  offerSearchSchema,
  type OfferSearchResult,
  type PublicAgency,
  type PublicReview,
} from '@drivetn/types';
import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Public, Roles } from '../common/auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { AgencyDirectoryService } from './agency-directory.service';
import { CustomerBookingsService } from './customer-bookings.service';
import { OffersService } from './offers.service';

@ApiTags('agencies')
@Public()
@Controller({ path: 'agencies', version: '1' })
export class AgencyDirectoryController {
  constructor(private readonly directory: AgencyDirectoryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Agences actives et leur position. Les numéros ne sont inclus que pour un client connecté.',
  })
  list(@Req() request: Request): Promise<PublicAgency[]> {
    return this.directory.list(request.user?.role === 'CUSTOMER');
  }

  @Get(':id/reviews')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Avis publiés d’une agence, sans le nom complet des clients' })
  reviews(@Param('id') id: string): Promise<PublicReview[]> {
    return this.directory.reviews(id);
  }
}

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

  @Get(':vehicleId/availability')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Dates déjà prises pour un véhicule, sans identité des clients' })
  availability(@Param('vehicleId') vehicleId: string) {
    return this.offers.availability(vehicleId);
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

  @Post(':id/review')
  @RateLimit({ name: 'create-review', limit: 10, windowSeconds: 60 * 60 })
  @ApiOperation({ summary: 'Noter une location après le retour du véhicule' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createReviewSchema)) body: CreateReviewInput,
    @Req() request: Request,
  ): Promise<CustomerBooking> {
    return this.bookings.submitReview(user.id, id, body, request.ip ?? null);
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
