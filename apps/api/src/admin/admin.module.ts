import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LocationsModule } from '../locations/locations.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AdminAgenciesService } from './admin-agencies.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminGeographyService } from './admin-geography.service';
import { AdminOverviewService } from './admin-overview.service';
import { AdminReferentialsController } from './admin-referentials.controller';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AuditFeedService } from './audit-feed.service';

@Module({
  imports: [AuthModule, MessagingModule, LocationsModule],
  controllers: [AdminController, AdminReferentialsController],
  providers: [
    AdminCatalogService,
    AdminGeographyService,
    AuditFeedService,
    AdminAgenciesService,
    AdminUsersService,
    AdminBookingsService,
    AdminBillingService,
    AdminReviewsService,
    AdminSettingsService,
    AdminOverviewService,
  ],
})
export class AdminModule {}
