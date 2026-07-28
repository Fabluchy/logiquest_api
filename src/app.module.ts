import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { EventService } from './events/event.service';

import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { SecurityModule } from './security/security.module';
import { HealthModule } from './health/health.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { CategoriesModule } from './categories/categories.module';
import { PuzzlesModule } from './puzzles/puzzles.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    AnalyticsModule,
    ScoringModule,
    AchievementsModule,
    RewardsModule,
    NotificationsModule,
    AdminModule,
    AuditModule,
    SecurityModule,
    HealthModule,
    CategoriesModule,
    PuzzlesModule,
    EmailModule,
  ],
  providers: [EventService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Log every inbound request across all routes.
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
