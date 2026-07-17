import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailPreferences } from './entities/email-preferences.entity';
import { UpdateEmailPreferencesDto } from './dto/update-email-preferences.dto';
import { EmailTemplate } from './interfaces/email-job.interface';

/** Non-critical templates that respect user opt-out preferences. */
const OPT_OUT_TEMPLATES: EmailTemplate[] = ['achievement-unlocked', 'weekly-summary'];

@Injectable()
export class EmailPreferencesService {
  constructor(
    @InjectRepository(EmailPreferences)
    private readonly repo: Repository<EmailPreferences>,
  ) {}

  /**
   * Returns the preferences for a user, creating defaults if none exist.
   */
  async getOrCreate(userId: string): Promise<EmailPreferences> {
    let prefs = await this.repo.findOne({ where: { userId } });
    if (!prefs) {
      prefs = this.repo.create({ userId });
      prefs = await this.repo.save(prefs);
    }
    return prefs;
  }

  /**
   * Update email preferences for a user (partial update).
   */
  async update(userId: string, dto: UpdateEmailPreferencesDto): Promise<EmailPreferences> {
    const prefs = await this.getOrCreate(userId);
    Object.assign(prefs, dto);
    return this.repo.save(prefs);
  }

  /**
   * Returns true if a user has opted in for the given template category.
   * Transactional templates (welcome, password-reset) always return true.
   */
  async isOptedIn(userId: string, template: EmailTemplate): Promise<boolean> {
    if (!OPT_OUT_TEMPLATES.includes(template)) {
      return true; // transactional — always send
    }

    const prefs = await this.repo.findOne({ where: { userId } });
    if (!prefs) return true; // default: opted in

    if (template === 'achievement-unlocked') return prefs.achievementEmails;
    if (template === 'weekly-summary') return prefs.weeklyEmails;

    return true;
  }
}
