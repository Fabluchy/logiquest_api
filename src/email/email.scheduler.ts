import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService, EmailTemplate } from './email.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class EmailScheduler {
  private readonly logger = new Logger(EmailScheduler.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Every Monday at 9:00 AM, send weekly summary emails to all active users.
   *
   * NOTE: The stats are currently placeholder values. Wire up real data from
   * sessions/scoring/leaderboard services before enabling in production.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklySummaries(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'Weekly summary cron fired but stats are not wired up yet. ' +
        'Skipping to avoid sending empty summaries. ' +
        'See src/email/email.scheduler.ts TODO.',
      );
      return;
    }

    this.logger.log('Starting weekly summary email dispatch...');

    const users = await this.userRepo.find();

    for (const user of users) {
      try {
        await this.emailService.sendEmail({
          to: user.email,
          template: EmailTemplate.WEEKLY_SUMMARY,
          context: {
            userId: user.id,
            username: user.username,
            // TODO: Fetch real stats from sessions/scoring/leaderboard services
            puzzlesSolved: 0,
            achievementsUnlocked: 0,
            scoreGained: 0,
            leaderboardRank: 0,
            newAchievements: [],
            appUrl: 'https://logiquest.com',
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to queue weekly summary for user ${user.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`Queued weekly summaries for ${users.length} users`);
  }
}
