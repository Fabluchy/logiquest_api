import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs';
import { SmtpProvider } from './providers/smtp.provider';
import { EmailPreference } from './entities/email-preference.entity';

export enum EmailTemplate {
  WELCOME = 'welcome',
  PASSWORD_RESET = 'password-reset',
  ACHIEVEMENT_UNLOCKED = 'achievement-unlocked',
  WEEKLY_SUMMARY = 'weekly-summary',
}

export interface EmailJobData {
  to: string;
  template: EmailTemplate;
  context: Record<string, unknown>;
  /** Critical emails (welcome, password-reset) bypass opt-out preferences */
  critical?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly templateDir: string;
  /** In-memory template cache for performance */
  private readonly templateCache = new Map<string, string>();

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly smtpProvider: SmtpProvider,
    @InjectRepository(EmailPreference)
    private readonly emailPrefRepo: Repository<EmailPreference>,
  ) {
    // Try dist first (compiled assets), fall back to src (dev/test mode)
    const distDir = path.resolve(__dirname, '..', 'email', 'templates');
    const srcDir = path.resolve(process.cwd(), 'src', 'email', 'templates');
    this.templateDir = fs.existsSync(distDir) ? distDir : srcDir;
  }

  /**
   * Queue an email to be sent asynchronously.
   */
  async sendEmail(data: EmailJobData): Promise<void> {
    // Check opt-out for non-critical emails
    if (!data.critical) {
      const userId = data.context.userId;
      if (typeof userId === 'string') {
        const pref = await this.emailPrefRepo.findOne({
          where: { userId },
        });
        if (pref?.optOutNonCritical) {
          this.logger.log(`Skipping non-critical email to ${data.to}: user opted out`);
          return;
        }
      }
    }

    await this.emailQueue.add('send-email', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
    this.logger.log(`Queued ${data.template} email for ${data.to}`);
  }

  /**
   * Load a template from disk (cached in memory after first read).
   */
  private loadTemplate(template: EmailTemplate): string {
    const cached = this.templateCache.get(template);
    if (cached) return cached;

    const templatePath = path.join(this.templateDir, `${template}.ejs`);
    const content = fs.readFileSync(templatePath, 'utf-8');
    this.templateCache.set(template, content);
    return content;
  }

  /**
   * Render an EJS template with the given context.
   * This method is public so it can be tested in isolation.
   */
  renderTemplate(template: EmailTemplate, context: Record<string, unknown>): string {
    const templateStr = this.loadTemplate(template);
    return ejs.render(templateStr, context);
  }

  /**
   * Actually send the email via the SMTP provider.
   * Called by the queue processor.
   */
  async sendEmailNow(data: EmailJobData): Promise<void> {
    const html = this.renderTemplate(data.template, data.context);
    const subject = this.getSubjectForTemplate(data.template, data.context);
    await this.smtpProvider.send({ to: data.to, subject, html });
  }

  /**
   * Send a test email (bypasses queue).
   */
  async sendTestEmail(to: string): Promise<void> {
    const html = this.renderTemplate(EmailTemplate.WELCOME, {
      username: 'TestUser',
      appUrl: 'https://logiquest.com',
    });
    await this.smtpProvider.send({
      to,
      subject: 'LogiQuest — Test Email',
      html,
    });
  }

  /**
   * Get or create email preferences for a user.
   */
  async getPreferences(userId: string): Promise<EmailPreference> {
    let pref = await this.emailPrefRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.emailPrefRepo.create({ userId });
      pref = await this.emailPrefRepo.save(pref);
    }
    return pref;
  }

  /**
   * Update email preferences for a user.
   */
  async updatePreferences(
    userId: string,
    data: { optOutNonCritical?: boolean },
  ): Promise<EmailPreference> {
    const pref = await this.getPreferences(userId);
    if (data.optOutNonCritical !== undefined) {
      pref.optOutNonCritical = data.optOutNonCritical;
    }
    return this.emailPrefRepo.save(pref);
  }

  private getSubjectForTemplate(
    template: EmailTemplate,
    context: Record<string, unknown>,
  ): string {
    switch (template) {
      case EmailTemplate.WELCOME:
        return 'Welcome to LogiQuest! 🧩';
      case EmailTemplate.PASSWORD_RESET:
        return 'LogiQuest — Password Reset Request';
      case EmailTemplate.ACHIEVEMENT_UNLOCKED:
        return `🏅 Achievement Unlocked: ${(context.achievementName as string) || 'New Badge!'}`;
      case EmailTemplate.WEEKLY_SUMMARY:
        return '📊 Your Weekly LogiQuest Summary';
      default:
        return 'LogiQuest Notification';
    }
  }
}
