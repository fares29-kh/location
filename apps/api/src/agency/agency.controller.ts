import {
  AGENCY_LOGO_MAX_BYTES,
  agencyProfileSchema,
  type AgencySettings,
  type BookingList,
  type BookingQuery,
  bookingQuerySchema,
  type BookingTransitionInput,
  bookingTransitionSchema,
  type BookingView,
  type DeskBookingInput,
  deskBookingSchema,
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
  type PlanningQuery,
  planningQuerySchema,
  type RecordPaymentInput,
  recordPaymentSchema,
  type RentalConditions,
  rentalConditionsSchema,
  type Review,
  type ReviewList,
  type ReviewQuery,
  reviewQuerySchema,
  type ReviewReportInput,
  reviewReplySchema,
  reviewReportSchema,
  isVehiclePhotoType,
  VEHICLE_PHOTO_MAX_BYTES,
  type VehicleInput,
  vehicleInputSchema,
  type VehicleMaintenance,
  vehicleMaintenanceInputSchema,
  type VehicleMaintenanceRequest,
  type VehiclePhoto,
  type VehiclePhotoOrder,
  vehiclePhotoOrderSchema,
  vehicleStatusInputSchema,
  type VehicleView,
} from '@drivetn/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { z } from 'zod';

import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser, Roles } from '../common/auth/decorators';
import { AppException } from '../common/errors/app.exception';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AgencyService } from './agency.service';
import { planningWindow } from './planning-window';
import { renderLogo, VehiclePhotosService } from './vehicle-photos.service';

function imageUpload(maxBytes: number) {
  return FileInterceptor('file', {
    limits: { fileSize: maxBytes, files: 1, fields: 0 },
    fileFilter: (_request, file, accept) => {
      if (isVehiclePhotoType(file.mimetype)) {
        accept(null, true);
        return;
      }
      accept(
        new AppException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'BAD_REQUEST',
          'Format non pris en charge (JPG, PNG ou WebP).',
          [{ path: 'file', message: 'UNSUPPORTED_IMAGE_TYPE' }],
        ),
        false,
      );
    },
  });
}

const photoUpload = imageUpload(VEHICLE_PHOTO_MAX_BYTES);
const logoUpload = imageUpload(AGENCY_LOGO_MAX_BYTES);

const FILE_BODY: Parameters<typeof ApiBody>[0] = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

function requireFile(file: { buffer: Buffer } | undefined): Buffer {
  if (file === undefined) {
    throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', 'Aucune image reçue.', [
      { path: 'file', message: 'REQUIRED' },
    ]);
  }
  return file.buffer;
}

/** Portail agence : données de l'agence du propriétaire connecté uniquement. */
@ApiTags('agency')
@ApiCookieAuth()
@Roles('AGENCY_OWNER')
@Controller({ path: 'agency', version: '1' })
export class AgencyController {
  constructor(
    private readonly agency: AgencyService,
    private readonly photos: VehiclePhotosService,
  ) {}

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

  @Post('bookings')
  @ApiOperation({ summary: 'Enregistrer une réservation prise au comptoir (confirmée)' })
  createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(deskBookingSchema)) body: DeskBookingInput,
    @Req() request: Request,
  ): Promise<BookingView> {
    return this.agency.createDeskBooking(user.id, body, request.ip ?? null);
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
  @ApiOperation({
    summary: 'Planning de la flotte sur [from, to[ (jours de Tunis, 62 jours au plus)',
  })
  planning(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(planningQuerySchema)) query: PlanningQuery,
  ): Promise<PlanningData> {
    return this.agency.getPlanning(user.id, planningWindow(query));
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
    @Req() request: Request,
  ): Promise<VehicleView> {
    return this.agency.setVehicleStatus(user.id, id, body.status, request.ip ?? null);
  }

  @Delete('vehicles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Retirer un véhicule de la flotte (refusé si une réservation est ouverte)',
  })
  deleteVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.agency.deleteVehicle(user.id, id, request.ip ?? null);
  }

  @Post('vehicles/:id/maintenances')
  @ApiOperation({ summary: 'Planifier un entretien (jours inclus) ; 409 si des réservations' })
  addMaintenance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehicleMaintenanceInputSchema)) body: VehicleMaintenanceRequest,
  ): Promise<VehicleMaintenance> {
    return this.agency.addMaintenance(user.id, id, body);
  }

  @Delete('vehicles/:id/maintenances/:maintenanceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un entretien planifié' })
  removeMaintenance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('maintenanceId') maintenanceId: string,
  ): Promise<void> {
    return this.agency.removeMaintenance(user.id, id, maintenanceId);
  }

  @Post('vehicles/:id/photos')
  @ApiOperation({ summary: 'Ajouter une photo (JPG, PNG ou WebP, 10 Mo max.)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(photoUpload)
  addVehiclePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<VehiclePhoto> {
    return this.photos.add(user.id, id, requireFile(file));
  }

  @Put('vehicles/:id/photos/order')
  @ApiOperation({ summary: 'Réordonner les photos (la première devient la couverture)' })
  reorderVehiclePhotos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(vehiclePhotoOrderSchema)) body: VehiclePhotoOrder,
  ): Promise<VehiclePhoto[]> {
    return this.photos.reorder(user.id, id, body.photoIds);
  }

  @Delete('vehicles/:id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une photo' })
  deleteVehiclePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    return this.photos.remove(user.id, id, photoId);
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
  @ApiOperation({ summary: 'Avis clients paginés et statistiques de tous les avis' })
  reviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reviewQuerySchema)) query: ReviewQuery,
  ): Promise<ReviewList> {
    return this.agency.listReviews(user.id, query);
  }

  @Post('reviews/:id/reply')
  @ApiOperation({ summary: 'Répondre publiquement à un avis' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewReplySchema)) body: z.output<typeof reviewReplySchema>,
    @Req() request: Request,
  ): Promise<Review> {
    return this.agency.replyToReview(user.id, id, body.reply, request.ip ?? null);
  }

  @Post('reviews/:id/report')
  @ApiOperation({ summary: 'Signaler un avis à la modération, sans le masquer' })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewReportSchema)) body: ReviewReportInput,
    @Req() request: Request,
  ): Promise<Review> {
    return this.agency.reportReview(user.id, id, body, request.ip ?? null);
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

  @Put('settings/logo')
  @ApiOperation({ summary: 'Remplacer le logo de l’agence (JPG, PNG ou WebP, 5 Mo max.)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(logoUpload)
  async updateLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<AgencySettings> {
    return this.agency.setLogo(user.id, await renderLogo(requireFile(file)));
  }

  @Delete('settings/logo')
  @ApiOperation({ summary: 'Retirer le logo de l’agence' })
  removeLogo(@CurrentUser() user: AuthenticatedUser): Promise<AgencySettings> {
    return this.agency.removeLogo(user.id);
  }
}
