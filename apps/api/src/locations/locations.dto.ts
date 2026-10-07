import {
  type Governorate,
  LOCATION_TYPES,
  type LocalizedText,
  type LocationType,
  type PickupLocation,
} from '@drivetn/types';
import { ApiProperty } from '@nestjs/swagger';

class LocalizedTextDto implements LocalizedText {
  @ApiProperty({ example: 'Tunis' })
  fr: string;

  @ApiProperty({ example: 'تونس' })
  ar: string;

  @ApiProperty({ example: 'Tunis' })
  en: string;
}

export class GovernorateDto implements Governorate {
  @ApiProperty({ example: '11' })
  code: string;

  @ApiProperty({ example: 'tunis' })
  slug: string;

  @ApiProperty({ type: LocalizedTextDto })
  name: LocalizedTextDto;
}

export class PickupLocationDto implements PickupLocation {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'aeroport-tunis-carthage' })
  slug: string;

  @ApiProperty({ enum: LOCATION_TYPES })
  type: LocationType;

  @ApiProperty({ example: '11' })
  governorateCode: string;

  @ApiProperty({ example: 'TUN', nullable: true, type: String })
  iataCode: string | null;

  @ApiProperty({ type: LocalizedTextDto })
  name: LocalizedTextDto;

  @ApiProperty({ example: 36.851 })
  latitude: number;

  @ApiProperty({ example: 10.227 })
  longitude: number;
}
