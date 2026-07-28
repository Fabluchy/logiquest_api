import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEmailPreferencesDto {
  @IsBoolean()
  @IsOptional()
  optOutNonCritical?: boolean;
}
