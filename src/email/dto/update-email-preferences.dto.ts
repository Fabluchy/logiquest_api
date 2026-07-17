import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEmailPreferencesDto {
  @IsOptional()
  @IsBoolean()
  achievementEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyEmails?: boolean;
}
