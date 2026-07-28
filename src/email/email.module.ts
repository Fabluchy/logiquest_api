import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailController } from './email.controller';
import { SmtpProvider } from './providers/smtp.provider';
import { EmailPreference } from './entities/email-preference.entity';
import { EmailEventListener } from './email.listener';
import { EmailScheduler } from './email.scheduler';
import { User } from '../users/entities/user.entity';
import { Achievement } from '../achievements/entities/achievement.entity';
import { LeaderboardEntry } from '../leaderboard/entities/leaderboard-entry.entity';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost') as string,
          port: configService.get('REDIS_PORT', 6379) as number,
          password: configService.get('REDIS_PASSWORD') as string | undefined,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    TypeOrmModule.forFeature([EmailPreference, User, Achievement, LeaderboardEntry]),
  ],
  controllers: [EmailController],
  providers: [EmailService, EmailProcessor, SmtpProvider, EmailEventListener, EmailScheduler],
  exports: [EmailService],
})
export class EmailModule {}
