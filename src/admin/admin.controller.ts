import { Body, Controller, Get, Patch, Param, Post, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginationDto } from './dto/pagination.dto';
import { SessionFilterDto } from './dto/session-filter.dto';
import { EmailQueueService } from '../email/email-queue.service';
import { SendTestEmailDto } from '../email/dto/send-test-email.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  @Get('users')
  getUsers(@Query() dto: PaginationDto) {
    return this.adminService.getUsers(dto);
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string, @Request() req) {
    const adminId = req.user.id;
    return this.adminService.banUser(adminId, id);
  }

  @Get('sessions')
  getSessions(@Query() dto: SessionFilterDto) {
    return this.adminService.getSessions(dto);
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  /**
   * POST /admin/email/test
   * Send a test email to a specified address using any available template.
   * Admin-only (enforced by class-level guards).
   */
  @Post('email/test')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendTestEmail(@Body() dto: SendTestEmailDto): Promise<{ message: string }> {
    const defaultContexts: Record<string, Record<string, unknown>> = {
      welcome: { username: 'TestUser', appUrl: 'https://logiquest.app', year: new Date().getFullYear() },
      'password-reset': { username: 'TestUser', resetUrl: 'https://logiquest.app/reset?token=test', expiresIn: '1 hour', year: new Date().getFullYear() },
      'achievement-unlocked': { username: 'TestUser', icon: '🏆', achievementName: 'Test Achievement', achievementDescription: 'This is a test.', nftReward: false, appUrl: 'https://logiquest.app', unsubscribeUrl: 'https://logiquest.app/unsubscribe', year: new Date().getFullYear() },
      'weekly-summary': { username: 'TestUser', weekStart: 'Mon', weekEnd: 'Sun', puzzlesSolved: 10, weeklyScore: 2500, rank: 42, achievementsUnlocked: 2, appUrl: 'https://logiquest.app', unsubscribeUrl: 'https://logiquest.app/unsubscribe', year: new Date().getFullYear() },
    };

    await this.emailQueueService.enqueue({
      to: dto.to,
      subject: `[LogiQuest Test] ${dto.template}`,
      template: dto.template,
      context: dto.context ?? defaultContexts[dto.template] ?? {},
    });

    return { message: `Test email queued for ${dto.to} using template "${dto.template}"` };
  }
}
