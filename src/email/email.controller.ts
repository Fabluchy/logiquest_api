import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('admin/email/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async sendTestEmail(@Body() dto: SendTestEmailDto): Promise<{ message: string }> {
    await this.emailService.sendTestEmail(dto.to);
    return { message: `Test email sent to ${dto.to}` };
  }
}
