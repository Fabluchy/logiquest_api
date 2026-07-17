export type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  | 'achievement-unlocked'
  | 'weekly-summary';

export interface EmailJob {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Template name to render */
  template: EmailTemplate;
  /** Dynamic data passed to the Handlebars template */
  context: Record<string, unknown>;
}
