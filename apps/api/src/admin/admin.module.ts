import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AdminAgenciesService } from './admin-agencies.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminOverviewService } from './admin-overview.service';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AuditFeedService } from './audit-feed.service';

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [AdminController],
  providers: [
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
