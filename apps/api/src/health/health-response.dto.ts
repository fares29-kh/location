import {
  type DependencyStatus,
  type HealthResponse,
  type HealthStatus,
  dependencyStatusSchema,
  healthStatusSchema,
} from '@drivetn/types';
import { ApiProperty } from '@nestjs/swagger';

class HealthChecksDto {
  @ApiProperty({ enum: dependencyStatusSchema.options })
  database: DependencyStatus;

  @ApiProperty({ enum: dependencyStatusSchema.options })
  redis: DependencyStatus;

  @ApiProperty({ enum: dependencyStatusSchema.options, description: 'Dépendance non critique' })
  worker: DependencyStatus;
}

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: healthStatusSchema.options })
  status: HealthStatus;

  @ApiProperty({ description: 'Temps de fonctionnement du processus, en secondes' })
  uptime: number;

  @ApiProperty({ format: 'date-time' })
  timestamp: string;

  @ApiProperty({ type: HealthChecksDto })
  checks: HealthChecksDto;
}
