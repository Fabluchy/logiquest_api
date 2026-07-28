import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailService, EmailJobData } from './email.service';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(
      `Processing email job ${job.id} — ${job.data.template} → ${job.data.to} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.emailService.sendEmailNow(job.data);
      this.logger.log(`Email job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to send email job ${job.id}: ${(error as Error).message}`,
      );
      throw error; // BullMQ will handle retries based on job options
    }
  }
}
