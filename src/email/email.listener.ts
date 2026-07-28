import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventName } from '../events/events.enum';
import { EmailService, EmailTemplate } from './email.service';
import { AchievementUnlockedPayload } from '../events/event-payloads';
import { User } from '../users/entities/user.entity';
import { Achievement } from '../achievements/entities/achievement.entity';

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  username: string;
}

@Injectable()
export class EmailEventListener {
  private readonly logger = new Logger(EmailEventListener.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
  ) {}

  @OnEvent('user.registered')
  async handleUserRegistered(payload: UserRegisteredPayload): Promise<void> {
    await this.emailService.sendEmail({
      to: payload.email,
      template: EmailTemplate.WELCOME,
      context: {
        username: payload.username,
        appUrl: 'https://logiquest.com',
      },
      critical: true,
    });
    this.logger.log(`Queued welcome email for user ${payload.username}`);
  }

  @OnEvent(EventName.AchievementUnlocked)
  async handleAchievementUnlocked(payload: AchievementUnlockedPayload): Promise<void> {
    try {
      const [user, achievement] = await Promise.all([
        this.userRepo.findOne({ where: { id: payload.userId } }),
        this.achievementRepo.findOne({ where: { id: payload.achievementId } }),
      ]);

      if (!user || !achievement) {
        this.logger.warn(
          `Cannot send achievement email: user or achievement not found ` +
          `(userId=${payload.userId}, achievementId=${payload.achievementId})`,
        );
        return;
      }

      await this.emailService.sendEmail({
        to: user.email,
        template: EmailTemplate.ACHIEVEMENT_UNLOCKED,
        context: {
          userId: user.id,
          username: user.username,
          achievementName: achievement.name,
          achievementDescription: achievement.description,
          rarity: achievement.rarity,
          appUrl: 'https://logiquest.com',
        },
      });

      this.logger.log(
        `Queued achievement unlocked email for user ${user.username}: ${achievement.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue achievement email: ${(error as Error).message}`,
      );
    }
  }
}
