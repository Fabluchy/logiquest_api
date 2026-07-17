import { IsEmail, IsNotEmpty, IsIn, IsOptional, IsObject } from 'class-validator';
import { EmailTemplate } from '../interfaces/email-job.interface';

const VALID_TEMPLATES: EmailTemplate[] = [
  'welcome',
  'password-reset',
  'achievement-unlocked',
  'weekly-summary',
];

export class SendTestEmailDto {
  @IsEmail()
  to!: string;

  @IsNotEmpty()
  @IsIn(VALID_TEMPLATES)
  template!: EmailTemplate;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
