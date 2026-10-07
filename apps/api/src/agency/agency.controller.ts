import {
  agencyProfileSchema,
  type AgencySettings,
  type BookingList,
  type BookingQuery,
  bookingQuerySchema,
  type BookingTransitionInput,
  bookingTransitionSchema,
  type BookingView,
  type CustomerDetail,
  type CustomerQuery,
  customerQuerySchema,
  type CustomerView,
  type DashboardData,
  type NavCounts,
  type Paginated,
  type PaymentList,
  type PaymentQuery,
  paymentQuerySchema,
  type PlanningData,
  planningQuerySchema,
  type RecordPaymentInput,
  recordPaymentSchema,
  type RentalConditions,
  rentalConditionsSchema,
  type Review,
  type ReviewList,
  reviewQuerySchema,
  reviewReplySchema,
  type VehicleInput,
  vehicleInputSchema,
  vehicleStatusInputSchema,
  type VehicleView,
} from '@drivetn/types';
import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { z } from 'zod';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../common/auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AgencyService } from './agency.service';

/** Portail agence : données de l'agence du propriétaire connecté uniquement. */
@ApiTags('agency')
@ApiCookieAuth()
@Roles('AGENCY_OWNER')
@Controller({ path: 'agency', version: '1' })
export class AgencyController {
  constructor(private readonly agency: AgencyService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Indicateurs, demandes en attente, départs et retours du jour' })
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<DashboardData> {
    return this.agency.getDashboard(user.id);
  }

  @Get('nav-counts')
  @ApiOperation({ summary: 'Compteurs de la navigation (demandes, avis sans réponse)' })
  navCounts(@CurrentUser() user: AuthenticatedUser): Promise<NavCounts> {
    return this.agency.getNavCounts(user.id);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Réservations filtrées, triées et paginées' })
  bookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(bookingQuerySchema)) query: BookingQuery,
  ): Promise<BookingList> {
    return this.agency.listBookings(user.id, query);
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Détail d’une réservation' })
  booking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<BookingView> {
    return this.agency.getBooking(user.id, id);
  }

  @Post('bookings/:id/transition')
  @ApiOperation({ summary: 'Confirmer, refuser, remettre, réceptionner, clôturer ou annuler' })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(bookingTransitionSchema)) body: BookingTransitionInput,
    @Req() request: Request,
  ): Promise<BookingView> {
    return this.agency.transitionBooking(user.id, id, body, request.ip ?? null);
  }

  @Post('bookings/:id/payments')
  @ApiOperation({ summary: 'Déclarer un encaissement, un remboursement ou une caution' })
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
    @Req() request: Request,
  ): Promise<BookingView> {
    return this.agency.recordPayment(user.id, id, body, request.ip ?? null);
  }

  @Get('planning')
  @ApiOperation({ summary: 'Planning de la flotte sur une période' })
  planning(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(planningQuerySchema)) query: z.output<typeof planningQuerySchema>,
  ): Promise<PlanningData> {
    return this.agency.getPlanning(user.id, query.from, query.days);
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'Flotte avec occupation et prochaines réservations' })
  vehicles(@CurrentUser() user: AuthenticatedUser): Promise<VehicleView[]> {
    return this.agency.listVehicles(user.id);
  }

  @Post('vehicles')
  @ApiOperation({ summary: 'Ajouter un véhicule' })
  createVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(vehicleInputSchema)) body: VehicleInput,
  ): Promise<VehicleView> {
    return this.agency.createVehicle(user.id, body);
  }

  @Put('vehicles/:id')
  @ApiOperation({ summary: 'Modifier un véhicule' })
  updateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleInputSchema)) body: VehicleInput,
  ): Promise<VehicleView> {
    return this.agency.updateVehicle(user.id, id, body);
  }

  @Patch('vehicles/:id/status')
  @ApiOperation({ summary: 'Mettre en service, en maintenance ou hors service' })
  setVehicleStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleStatusInputSchema))
    body: z.output<typeof vehicleStatusInputSchema>,
  ): Promise<VehicleView> {
    return this.agency.setVehicleStatus(user.id, id, body.status);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Clients ayant réservé auprès de l’agence' })
  customers(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(customerQuerySchema)) query: CustomerQuery,
  ): Promise<Paginated<CustomerView>> {
    return this.agency.listCustomers(user.id, query);
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Fiche client et historique de ses réservations' })
  customer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CustomerDetail> {
    return this.agency.getCustomer(user.id, id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Journal des encaissements et synthèse du mois' })
  payments(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(paymentQuerySchema)) query: PaymentQuery,
  ): Promise<PaymentList> {
    return this.agency.listPayments(user.id, query);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Avis clients et statistiques' })
  reviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reviewQuerySchema)) query: z.output<typeof reviewQuerySchema>,
  ): Promise<ReviewList> {
    return this.agency.listReviews(user.id, query.filter);
  }

  @Post('reviews/:id/reply')
  @ApiOperation({ summary: 'Répondre publiquement à un avis' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewReplySchema)) body: z.output<typeof reviewReplySchema>,
  ): Promise<Review> {
    return this.agency.replyToReview(user.id, id, body.reply);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Fiche agence et conditions de location' })
  settings(@CurrentUser() user: AuthenticatedUser): Promise<AgencySettings> {
    return this.agency.getSettings(user.id);
  }

  @Put('settings/profile')
  @ApiOperation({ summary: 'Mettre à jour la fiche agence' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(agencyProfileSchema)) body: z.output<typeof agencyProfileSchema>,
  ): Promise<AgencySettings> {
    return this.agency.updateProfile(user.id, body);
  }

  @Put('settings/conditions')
  @ApiOperation({ summary: 'Mettre à jour les conditions de location' })
  updateConditions(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(rentalConditionsSchema)) body: RentalConditions,
  ): Promise<AgencySettings> {
    return this.agency.updateConditions(user.id, body);
  }
}
