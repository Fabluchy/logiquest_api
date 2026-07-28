import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailService, EmailTemplate, EmailJobData } from './email.service';
import { SmtpProvider } from './providers/smtp.provider';
import { EmailPreference } from './entities/email-preference.entity';
import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let emailQueue: { add: jest.Mock };
  let smtpProvider: { send: jest.Mock };
  let emailPrefRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    emailQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    smtpProvider = { send: jest.fn().mockResolvedValue(undefined) };
    emailPrefRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getQueueToken('email'),
          useValue: emailQueue,
        },
        {
          provide: SmtpProvider,
          useValue: smtpProvider,
        },
        {
          provide: getRepositoryToken(EmailPreference),
          useValue: emailPrefRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Template Rendering ─────────────────────────────────────────

  describe('renderTemplate', () => {
    it('should render the welcome template with context', () => {
      const html = service.renderTemplate(EmailTemplate.WELCOME, {
        username: 'TestUser',
        appUrl: 'https://logiquest.com',
      });
      expect(html).toContain('Welcome to LogiQuest');
      expect(html).toContain('TestUser');
      expect(html).toContain('https://logiquest.com');
    });

    it('should render the password-reset template with context', () => {
      const html = service.renderTemplate(EmailTemplate.PASSWORD_RESET, {
        username: 'TestUser',
        resetUrl: 'https://logiquest.com/reset/token123',
      });
      expect(html).toContain('Password Reset');
      expect(html).toContain('TestUser');
      expect(html).toContain('https://logiquest.com/reset/token123');
    });

    it('should render the achievement-unlocked template with context', () => {
      const html = service.renderTemplate(EmailTemplate.ACHIEVEMENT_UNLOCKED, {
        username: 'TestUser',
        achievementName: 'Puzzle Master',
        achievementDescription: 'Solved 100 puzzles',
        rarity: 'epic',
        appUrl: 'https://logiquest.com',
      });
      expect(html).toContain('Achievement Unlocked');
      expect(html).toContain('Puzzle Master');
      expect(html).toContain('Solved 100 puzzles');
      expect(html).toContain('epic');
    });

    it('should render the weekly-summary template with context', () => {
      const html = service.renderTemplate(EmailTemplate.WEEKLY_SUMMARY, {
        username: 'TestUser',
        puzzlesSolved: 15,
        achievementsUnlocked: 3,
        scoreGained: 1250,
        leaderboardRank: 42,
        newAchievements: [],
        appUrl: 'https://logiquest.com',
      });
      expect(html).toContain('Weekly Summary');
      expect(html).toContain('15');
      expect(html).toContain('3');
      expect(html).toContain('1250');
      expect(html).toContain('42');
    });
  });

  // ─── Queue Submission ────────────────────────────────────────────

  describe('sendEmail', () => {
    const baseJobData: EmailJobData = {
      to: 'user@test.com',
      template: EmailTemplate.WELCOME,
      context: { userId: 'user-1', username: 'TestUser' },
      critical: true,
    };

    it('should add a job to the email queue with retry options', async () => {
      await service.sendEmail(baseJobData);

      expect(emailQueue.add).toHaveBeenCalledWith('send-email', baseJobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    });

    it('should skip queue if user opted out of non-critical emails', async () => {
      emailPrefRepo.findOne.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        optOutNonCritical: true,
      });

      await service.sendEmail({
        ...baseJobData,
        critical: false,
      });

      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it('should still send critical emails even if user opted out', async () => {
      emailPrefRepo.findOne.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        optOutNonCritical: true,
      });

      await service.sendEmail({
        ...baseJobData,
        critical: true,
      });

      expect(emailQueue.add).toHaveBeenCalled();
    });

    it('should queue the email if no preference record exists', async () => {
      emailPrefRepo.findOne.mockResolvedValue(null);

      await service.sendEmail({
        ...baseJobData,
        critical: false,
      });

      expect(emailQueue.add).toHaveBeenCalled();
    });
  });

  // ─── Send Email Now (Actual Send) ────────────────────────────────

  describe('sendEmailNow', () => {
    it('should render template and send via SMTP provider', async () => {
      const htmlSpy = jest.spyOn(service, 'renderTemplate');

      await service.sendEmailNow({
        to: 'user@test.com',
        template: EmailTemplate.WELCOME,
        context: { username: 'TestUser', appUrl: 'https://logiquest.com' },
      });

      expect(htmlSpy).toHaveBeenCalledWith(EmailTemplate.WELCOME, {
        username: 'TestUser',
        appUrl: 'https://logiquest.com',
      });
      expect(smtpProvider.send).toHaveBeenCalledWith({
        to: 'user@test.com',
        subject: 'Welcome to LogiQuest! 🧩',
        html: expect.stringContaining('Welcome to LogiQuest'),
      });
    });

    it('should use the correct subject for password reset', async () => {
      await service.sendEmailNow({
        to: 'user@test.com',
        template: EmailTemplate.PASSWORD_RESET,
        context: { username: 'TestUser', resetUrl: 'https://logiquest.com/reset/token' },
      });

      expect(smtpProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'LogiQuest — Password Reset Request',
        }),
      );
    });
  });

  // ─── Test Email ──────────────────────────────────────────────────

  describe('sendTestEmail', () => {
    it('should send a welcome email to the specified address', async () => {
      await service.sendTestEmail('admin@test.com');

      expect(smtpProvider.send).toHaveBeenCalledWith({
        to: 'admin@test.com',
        subject: 'LogiQuest — Test Email',
        html: expect.stringContaining('Welcome to LogiQuest'),
      });
    });
  });

  // ─── Email Preferences ──────────────────────────────────────────

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      emailPrefRepo.findOne.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        optOutNonCritical: true,
      });

      const pref = await service.getPreferences('user-1');
      expect(pref.optOutNonCritical).toBe(true);
      expect(emailPrefRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should create preferences if none exist', async () => {
      emailPrefRepo.findOne.mockResolvedValue(null);
      emailPrefRepo.create.mockReturnValue({
        userId: 'user-1',
        optOutNonCritical: false,
      });
      emailPrefRepo.save.mockResolvedValue({
        id: 'pref-new',
        userId: 'user-1',
        optOutNonCritical: false,
      });

      const pref = await service.getPreferences('user-1');
      expect(emailPrefRepo.create).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(pref.optOutNonCritical).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should update optOutNonCritical flag', async () => {
      emailPrefRepo.findOne.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        optOutNonCritical: false,
      });
      emailPrefRepo.save.mockImplementation(async (p) => p);

      const pref = await service.updatePreferences('user-1', {
        optOutNonCritical: true,
      });
      expect(pref.optOutNonCritical).toBe(true);
    });
  });
});
