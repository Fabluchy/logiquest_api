import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EMAIL_QUEUE, EMAIL_JOB } from './email.constants';
import { EmailService } from './email.service';
import { EmailJob } from './interfaces/email-job.interface';

/**
 * BullMQ worker that processes email jobs from the queue.
 *
 * When sendEmail() throws, BullMQ automatically re-queues the job according
 * to the backoff/attempts settings specified at enqueue time (up to 3 tries).
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    if (job.name !== EMAIL_JOB) {
      this.logger.warn(`Unknown job name received: ${job.name}`);
      return;
    }

    this.logger.log(
      `Processing email job ${job.id} → ${job.data.to} [attempt ${job.attemptsMade + 1}/3]`,
    );

    try {
      await this.emailService.sendEmail(job.data);
    } catch (err) {
      this.logger.error(
        `Failed to send email (job ${job.id}, attempt ${job.attemptsMade + 1}): ${(err as Error).message}`,
      );
      // Re-throw so BullMQ can apply the retry / backoff policy.
      throw err;
    }
  }
}
