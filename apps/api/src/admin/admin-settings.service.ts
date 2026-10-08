import type { PlatformSettings } from '@drivetn/types';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import {
  describeSettingsChanges,
  PlatformSettingsService,
} from '../platform/platform-settings.service';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly audit: AuditService,
  ) {}

  get(): Promise<PlatformSettings> {
    return this.settings.get();
  }

  async update(
    next: PlatformSettings,
    actorId: string,
    ip: string | null,
  ): Promise<PlatformSettings> {
    const before = await this.settings.get();
    const saved = await this.settings.update(next);
    const changes = describeSettingsChanges(before, saved);
    if (changes.length > 0) {
      await this.audit.log({
        action: 'settings.updated',
        actorId,
        metadata: { changes: changes.join(' · ') },
        ip,
      });
    }
    return saved;
  }
}
