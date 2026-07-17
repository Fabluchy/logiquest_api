import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, EMAIL_JOB } from './email.constants';
import { EmailJob } from './interfaces/email-job.interface';

/**
 * Thin wrapper around the BullMQ Queue that enqueues email jobs.
 *
 * Retry strategy: up to 3 attempts with exponential backoff
 *  attempt 1 delay: 0 ms (immediate)
 *  attempt 2 delay: 2 000 ms
 *  attempt 3 delay: 4 000 ms
 */
@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJob>,
  ) {}

  /**
   * Enqueue an email to be sent asynchronously.
   * BullMQ will retry up to 3 times with exponential backoff on failure.
   */
  async enqueue(job: EmailJob): Promise<void> {
    await this.emailQueue.add(EMAIL_JOB, job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2 s, 4 s on successive retries
      },
      removeOnComplete: true,
      removeOnFail: false, // keep failed jobs for inspection
    });

    this.logger.log(`Queued email → ${job.to} [template: ${job.template}]`);
  }
}
