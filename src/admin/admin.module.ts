import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { Reward } from '../rewards/entities/reward.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, Reward]),
    AuditModule,
    EmailModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
