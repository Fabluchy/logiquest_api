import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { EMAIL_QUEUE } from './email.constants';
import { EmailService } from './email.service';
import { EmailQueueService } from './email-queue.service';
import { EmailProcessor } from './email.processor';
import { EmailPreferencesService } from './email-preferences.service';
import { EmailPreferences } from './entities/email-preferences.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailPreferences]),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: EMAIL_QUEUE,
    }),
  ],
  providers: [
    EmailService,
    EmailQueueService,
    EmailProcessor,
    EmailPreferencesService,
  ],
  exports: [EmailService, EmailQueueService, EmailPreferencesService],
})
export class EmailModule {}
