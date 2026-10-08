import {
  type AdminAgency,
  type AdminAgencyDetail,
  type AdminAgencyList,
  type AdminAgencyQuery,
  adminAgencyQuerySchema,
  type AdminAuditEntry,
  type AdminDashboard,
  type AdminNavCounts,
  type AgencyDecisionInput,
  agencyDecisionInputSchema,
  type AuditQuery,
  auditQuerySchema,
  type Invoice,
  type InvoiceList,
  type InvoiceQuery,
  invoiceQuerySchema,
  type MarkInvoicePaidInput,
  markInvoicePaidSchema,
  type ModeratedReview,
  type ModeratedReviewList,
  type ModerationQuery,
  moderationQuerySchema,
  type Paginated,
  type PlatformBookingList,
  type PlatformBookingQuery,
  platformBookingQuerySchema,
  type PlatformSettings,
  platformSettingsSchema,
  type PlatformUser,
  type ReviewModerationInput,
  reviewModerationInputSchema,
  type UserDetail,
  type UserList,
  type UserQuery,
  userQuerySchema,
  type UserStatusInput,
  userStatusInputSchema,
} from '@drivetn/types';
import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, RequireAdminPermission, Roles } from '../common/auth/decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminAgenciesService } from './admin-agencies.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminOverviewService } from './admin-overview.service';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminUsersService } from './admin-users.service';
import { AuditFeedService } from './audit-feed.service';

/**
 * Portail d'administration : tous les rôles admin consultent l'ensemble des écrans,
 * les actions sont réservées selon le rôle (`@RequireAdminPermission`).
 */
@ApiTags('admin')
@ApiCookieAuth()
@Roles('ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly agencies: AdminAgenciesService,
    private readonly users: AdminUsersService,
    private readonly bookings: AdminBookingsService,
    private readonly billing: AdminBillingService,
    private readonly reviews: AdminReviewsService,
    private readonly feed: AuditFeedService,
    private readonly settings: AdminSettingsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Indicateurs de la plateforme, demandes en attente, activité' })
  dashboard(): Promise<AdminDashboard> {
    return this.overview.dashboard();
  }

  @Get('nav-counts')
  @ApiOperation({ summary: 'Compteurs de la navigation (agences, avis, factures)' })
  navCounts(): Promise<AdminNavCounts> {
    return this.overview.navCounts();
  }

  // --- Agences -------------------------------------------------------------------

  @Get('agencies')
  @ApiOperation({ summary: 'Agences filtrées par statut, recherche et pagination' })
  listAgencies(
    @Query(new ZodValidationPipe(adminAgencyQuerySchema)) query: AdminAgencyQuery,
  ): Promise<AdminAgencyList> {
    return this.agencies.list(query);
  }

  @Get('agencies/:id')
  @ApiOperation({ summary: 'Fiche agence : pièces, réservations, factures, historique' })
  agency(@Param('id') id: string): Promise<AdminAgencyDetail> {
    return this.agencies.detail(id);
  }

  @Post('agencies/:id/decision')
  @RequireAdminPermission('agencies.decide')
  @ApiOperation({ summary: 'Valider, refuser, suspendre ou réactiver une agence' })
  decideAgency(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(agencyDecisionInputSchema)) body: AgencyDecisionInput,
    @Req() request: Request,
  ): Promise<AdminAgency> {
    return this.agencies.decide(id, body, user.id, request.ip ?? null);
  }

  // --- Comptes -------------------------------------------------------------------

  @Get('users')
  @ApiOperation({ summary: 'Comptes clients, agences et administrateurs' })
  listUsers(@Query(new ZodValidationPipe(userQuerySchema)) query: UserQuery): Promise<UserList> {
    return this.users.list(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Fiche compte et activité récente' })
  user(@Param('id') id: string): Promise<UserDetail> {
    return this.users.detail(id);
  }

  @Post('users/:id/status')
  @RequireAdminPermission('users.manage')
  @ApiOperation({ summary: 'Suspendre ou réactiver un compte (hors administrateurs)' })
  setUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(userStatusInputSchema)) body: UserStatusInput,
    @Req() request: Request,
  ): Promise<PlatformUser> {
    return this.users.setStatus(id, body, user.id, request.ip ?? null);
  }

  // --- Réservations -----------------------------------------------------------------

  @Get('bookings')
  @ApiOperation({ summary: 'Réservations de toutes les agences' })
  listBookings(
    @Query(new ZodValidationPipe(platformBookingQuerySchema)) query: PlatformBookingQuery,
  ): Promise<PlatformBookingList> {
    return this.bookings.list(query);
  }

  // --- Facturation ------------------------------------------------------------------

  @Get('invoices')
  @ApiOperation({ summary: 'Factures d’abonnement et synthèse de la facturation' })
  listInvoices(
    @Query(new ZodValidationPipe(invoiceQuerySchema)) query: InvoiceQuery,
  ): Promise<InvoiceList> {
    return this.billing.list(query);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Détail d’une facture' })
  invoice(@Param('id') id: string): Promise<Invoice> {
    return this.billing.get(id);
  }

  @Post('invoices/:id/payment')
  @RequireAdminPermission('billing.manage')
  @ApiOperation({ summary: 'Enregistrer le règlement d’une facture' })
  markInvoicePaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markInvoicePaidSchema)) body: MarkInvoicePaidInput,
    @Req() request: Request,
  ): Promise<Invoice> {
    return this.billing.markPaid(id, body.method, user.id, request.ip ?? null);
  }

  @Post('invoices/:id/reminder')
  @RequireAdminPermission('billing.manage')
  @ApiOperation({ summary: 'Relancer l’agence par WhatsApp' })
  sendInvoiceReminder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Invoice> {
    return this.billing.sendReminder(id, user.id, request.ip ?? null);
  }

  // --- Avis ---------------------------------------------------------------------------

  @Get('reviews')
  @ApiOperation({ summary: 'Avis à modérer, publiés ou masqués' })
  listReviews(
    @Query(new ZodValidationPipe(moderationQuerySchema)) query: ModerationQuery,
  ): Promise<ModeratedReviewList> {
    return this.reviews.list(query);
  }

  @Post('reviews/:id/moderation')
  @RequireAdminPermission('reviews.moderate')
  @ApiOperation({ summary: 'Publier ou masquer un avis' })
  moderateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewModerationInputSchema)) body: ReviewModerationInput,
    @Req() request: Request,
  ): Promise<ModeratedReview> {
    return this.reviews.moderate(id, body, user.id, request.ip ?? null);
  }

  // --- Journal et paramètres -------------------------------------------------------------

  @Get('audit')
  @ApiOperation({ summary: 'Journal d’audit de la plateforme' })
  audit(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<Paginated<AdminAuditEntry>> {
    return this.feed.list(query);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Paramètres de la plateforme' })
  getSettings(): Promise<PlatformSettings> {
    return this.settings.get();
  }

  @Put('settings')
  @RequireAdminPermission('settings.manage')
  @ApiOperation({ summary: 'Modifier les paramètres de la plateforme' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(platformSettingsSchema)) body: PlatformSettings,
    @Req() request: Request,
  ): Promise<PlatformSettings> {
    return this.settings.update(body, user.id, request.ip ?? null);
  }
}
