import { Global, Module } from '@nestjs/common';

import { BookingExpiryService } from './booking-expiry.service';
import { InvoicingService } from './invoicing.service';
import { PlatformSettingsService } from './platform-settings.service';

/** Règles de la plateforme partagées par l'API et le worker (paramètres, facturation, expiration). */
@Global()
@Module({
  providers: [PlatformSettingsService, InvoicingService, BookingExpiryService],
  exports: [PlatformSettingsService, InvoicingService, BookingExpiryService],
})
export class PlatformModule {}
