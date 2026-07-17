import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { EmailJob, EmailTemplate } from './interfaces/email-job.interface';

/**
 * Core email sending service.
 *
 * Supports two transport modes selected via EMAIL_PROVIDER env var:
 *  - "smtp"      → uses SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *  - "sendgrid"  → uses SENDGRID_API_KEY via SMTP relay (api.sendgrid.com:587)
 *
 * Templates are Handlebars (.hbs) files living in src/email/templates/.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private readonly templateCache = new Map<EmailTemplate, handlebars.TemplateDelegate>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.transporter = this.createTransporter();
    this.preloadTemplates();
  }

  // ─── Transport factory ───────────────────────────────────────────────────

  private createTransporter(): nodemailer.Transporter {
    const provider = this.config.get<string>('EMAIL_PROVIDER', 'smtp');

    if (provider === 'sendgrid') {
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: this.config.get<string>('SENDGRID_API_KEY', ''),
        },
      });
    }

    // Default: SMTP
    return nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
    });
  }

  // ─── Template management ─────────────────────────────────────────────────

  private preloadTemplates(): void {
    const templates: EmailTemplate[] = [
      'welcome',
      'password-reset',
      'achievement-unlocked',
      'weekly-summary',
    ];

    for (const name of templates) {
      try {
        const compiled = this.loadTemplate(name);
        this.templateCache.set(name, compiled);
      } catch (err) {
        this.logger.warn(`Could not preload template "${name}": ${(err as Error).message}`);
      }
    }
  }

  /**
   * Load and compile a Handlebars template from disk.
   * Resolves relative to the compiled output directory so it works both
   * in ts-node (src/) and compiled dist/.
   */
  loadTemplate(name: EmailTemplate): handlebars.TemplateDelegate {
    // Try multiple resolution paths for flexibility
    const candidates = [
      path.resolve(__dirname, 'templates', `${name}.hbs`),
      path.resolve(process.cwd(), 'src', 'email', 'templates', `${name}.hbs`),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const source = fs.readFileSync(candidate, 'utf8');
        return handlebars.compile(source);
      }
    }

    throw new Error(`Email template "${name}" not found in: ${candidates.join(', ')}`);
  }

  /**
   * Render a template with the provided context data.
   */
  renderTemplate(name: EmailTemplate, context: Record<string, unknown>): string {
    let compiled = this.templateCache.get(name);
    if (!compiled) {
      compiled = this.loadTemplate(name);
      this.templateCache.set(name, compiled);
    }
    return compiled(context);
  }

  // ─── Sending ─────────────────────────────────────────────────────────────

  /**
   * Send a single email. Called directly by the BullMQ processor.
   * Throws on failure so BullMQ can trigger its retry logic.
   */
  async sendEmail(job: EmailJob): Promise<void> {
    const html = this.renderTemplate(job.template, job.context);

    await this.transporter.sendMail({
      from: this.config.get<string>('EMAIL_FROM', 'noreply@logiquest.app'),
      to: job.to,
      subject: job.subject,
      html,
    });

    this.logger.log(`Email sent → ${job.to} [template: ${job.template}]`);
  }
}
