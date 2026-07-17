import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { EmailService } from './email.service';
import { EmailTemplate } from './interfaces/email-job.interface';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter),
}));

// ─── EmailService ─────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'localhost',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        EMAIL_FROM: 'noreply@logiquest.app',
      };
      return values[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    // Manually trigger lifecycle hook so the transporter is initialised
    service.onModuleInit();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Template rendering ─────────────────────────────────────────────────

  describe('renderTemplate', () => {
    it('should render the welcome template with context data', () => {
      const html = service.renderTemplate('welcome', {
        username: 'Alice',
        appUrl: 'https://logiquest.app',
        year: 2026,
      });

      expect(html).toContain('Alice');
      expect(html).toContain('https://logiquest.app');
      expect(html).toContain('2026');
    });

    it('should render the password-reset template with resetUrl', () => {
      const html = service.renderTemplate('password-reset', {
        username: 'Bob',
        resetUrl: 'https://logiquest.app/reset?token=abc123',
        expiresIn: '1 hour',
        year: 2026,
      });

      expect(html).toContain('Bob');
      expect(html).toContain('https://logiquest.app/reset?token=abc123');
      expect(html).toContain('1 hour');
    });

    it('should render the achievement-unlocked template', () => {
      const html = service.renderTemplate('achievement-unlocked', {
        username: 'Charlie',
        icon: '🏆',
        achievementName: 'Puzzle Master',
        achievementDescription: 'Solve 100 puzzles',
        nftReward: true,
        appUrl: 'https://logiquest.app',
        unsubscribeUrl: 'https://logiquest.app/unsubscribe',
        year: 2026,
      });

      expect(html).toContain('Charlie');
      expect(html).toContain('Puzzle Master');
      expect(html).toContain('Solve 100 puzzles');
      expect(html).toContain('NFT Reward');
    });

    it('should render the weekly-summary template', () => {
      const html = service.renderTemplate('weekly-summary', {
        username: 'Dana',
        weekStart: 'Jul 14',
        weekEnd: 'Jul 20',
        puzzlesSolved: 7,
        weeklyScore: 1750,
        rank: 15,
        achievementsUnlocked: 1,
        appUrl: 'https://logiquest.app',
        unsubscribeUrl: 'https://logiquest.app/unsubscribe',
        year: 2026,
      });

      expect(html).toContain('Dana');
      expect(html).toContain('Jul 14');
      expect(html).toContain('7');
      expect(html).toContain('1750');
    });

    it('should NOT show nftReward section when nftReward is false', () => {
      const html = service.renderTemplate('achievement-unlocked', {
        username: 'Eve',
        icon: '🎖️',
        achievementName: 'First Blood',
        achievementDescription: 'Complete first puzzle',
        nftReward: false,
        appUrl: 'https://logiquest.app',
        unsubscribeUrl: 'https://logiquest.app/unsubscribe',
        year: 2026,
      });

      expect(html).not.toContain('NFT Reward');
    });

    it('should throw an error for an unknown template', () => {
      expect(() =>
        service.renderTemplate('nonexistent' as EmailTemplate, {}),
      ).toThrow();
    });

    it('should cache the compiled template on second call', () => {
      // Clear the template cache by creating a fresh service for this test
      const freshService = new (EmailService as any)(mockConfig);
      freshService.onModuleInit();

      const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('<p>{{username}}</p>' as any);

      // Force cache miss on a template name that hasn't been loaded yet
      (freshService as any).templateCache.clear();

      freshService.renderTemplate('welcome', { username: 'Test' });
      freshService.renderTemplate('welcome', { username: 'Test2' });

      expect(readSpy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
      readSpy.mockRestore();
    });
  });

  // ─── sendEmail ──────────────────────────────────────────────────────────

  describe('sendEmail', () => {
    it('should call transporter.sendMail with correct parameters', async () => {
      await service.sendEmail({
        to: 'player@example.com',
        subject: 'Welcome!',
        template: 'welcome',
        context: { username: 'Alice', appUrl: 'https://logiquest.app', year: 2026 },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'player@example.com',
          subject: 'Welcome!',
          from: 'noreply@logiquest.app',
          html: expect.any(String),
        }),
      );
    });

    it('should propagate errors from the transporter', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      await expect(
        service.sendEmail({
          to: 'player@example.com',
          subject: 'Test',
          template: 'welcome',
          context: { username: 'Alice', appUrl: 'https://logiquest.app', year: 2026 },
        }),
      ).rejects.toThrow('SMTP connection failed');
    });
  });
});

// ─── EmailQueueService ────────────────────────────────────────────────────────

import { EmailQueueService } from './email-queue.service';
import { getQueueToken } from '@nestjs/bullmq';
import { EMAIL_QUEUE, EMAIL_JOB } from './email.constants';

describe('EmailQueueService', () => {
  let service: EmailQueueService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueService,
        {
          provide: getQueueToken(EMAIL_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<EmailQueueService>(EmailQueueService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue', () => {
    it('should add a job to the queue with correct data', async () => {
      const job = {
        to: 'player@example.com',
        subject: 'Welcome!',
        template: 'welcome' as EmailTemplate,
        context: { username: 'Alice' },
      };

      await service.enqueue(job);

      expect(mockQueue.add).toHaveBeenCalledWith(EMAIL_JOB, job, expect.any(Object));
    });

    it('should configure retry: 3 attempts with exponential backoff', async () => {
      await service.enqueue({
        to: 'test@example.com',
        subject: 'Test',
        template: 'welcome',
        context: {},
      });

      const [, , options] = mockQueue.add.mock.calls[0];
      expect(options.attempts).toBe(3);
      expect(options.backoff).toEqual({ type: 'exponential', delay: 2000 });
    });

    it('should propagate errors if the queue throws', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(
        service.enqueue({
          to: 'test@example.com',
          subject: 'Test',
          template: 'welcome',
          context: {},
        }),
      ).rejects.toThrow('Redis unavailable');
    });
  });
});

// ─── EmailProcessor ───────────────────────────────────────────────────────────

import { EmailProcessor } from './email.processor';
import { Job } from 'bullmq';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  const makeJob = (overrides: Partial<Job<any>> = {}): Job<any> =>
    ({
      id: 'job-1',
      name: EMAIL_JOB,
      attemptsMade: 0,
      data: {
        to: 'player@example.com',
        subject: 'Test',
        template: 'welcome',
        context: { username: 'Alice', appUrl: 'https://logiquest.app', year: 2026 },
      },
      ...overrides,
    } as unknown as Job<any>);

  it('should call emailService.sendEmail with job data', async () => {
    const job = makeJob();
    await processor.process(job);

    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(job.data);
  });

  it('should re-throw errors so BullMQ can retry', async () => {
    mockEmailService.sendEmail.mockRejectedValueOnce(new Error('SMTP down'));

    const job = makeJob({ attemptsMade: 1 });
    await expect(processor.process(job)).rejects.toThrow('SMTP down');
  });

  it('should skip processing for unknown job names', async () => {
    const job = makeJob({ name: 'unknown-job' });
    await processor.process(job);

    expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
  });
});

// ─── EmailPreferencesService ──────────────────────────────────────────────────

import { EmailPreferencesService } from './email-preferences.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailPreferences } from './entities/email-preferences.entity';

describe('EmailPreferencesService', () => {
  let service: EmailPreferencesService;

  const basePrefs: EmailPreferences = {
    id: 'pref-uuid',
    userId: 'user-uuid',
    achievementEmails: true,
    weeklyEmails: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({ ...basePrefs, ...dto })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...basePrefs, ...entity })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailPreferencesService,
        {
          provide: getRepositoryToken(EmailPreferences),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<EmailPreferencesService>(EmailPreferencesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getOrCreate ──────────────────────────────────────────────────────

  describe('getOrCreate', () => {
    it('should return existing preferences if found', async () => {
      mockRepo.findOne.mockResolvedValue(basePrefs);

      const result = await service.getOrCreate('user-uuid');

      expect(result).toEqual(basePrefs);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should create and return default preferences if none exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getOrCreate('user-uuid');

      expect(mockRepo.create).toHaveBeenCalledWith({ userId: 'user-uuid' });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.userId).toBe('user-uuid');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update achievementEmails preference', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs });

      const result = await service.update('user-uuid', { achievementEmails: false });

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ achievementEmails: false }));
      expect(result.achievementEmails).toBe(false);
    });

    it('should update weeklyEmails preference', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs });

      const result = await service.update('user-uuid', { weeklyEmails: false });

      expect(result.weeklyEmails).toBe(false);
    });

    it('should preserve unchanged preferences on partial update', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs, weeklyEmails: false });

      const result = await service.update('user-uuid', { achievementEmails: false });

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ achievementEmails: false, weeklyEmails: false }),
      );
    });
  });

  // ─── isOptedIn — opt-out enforcement ──────────────────────────────────

  describe('isOptedIn', () => {
    it('should always return true for transactional templates (welcome)', async () => {
      const result = await service.isOptedIn('user-uuid', 'welcome');
      expect(result).toBe(true);
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('should always return true for transactional templates (password-reset)', async () => {
      const result = await service.isOptedIn('user-uuid', 'password-reset');
      expect(result).toBe(true);
    });

    it('should return true for achievement-unlocked when opted in', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs, achievementEmails: true });

      const result = await service.isOptedIn('user-uuid', 'achievement-unlocked');
      expect(result).toBe(true);
    });

    it('should return false for achievement-unlocked when opted out', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs, achievementEmails: false });

      const result = await service.isOptedIn('user-uuid', 'achievement-unlocked');
      expect(result).toBe(false);
    });

    it('should return true for weekly-summary when opted in', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs, weeklyEmails: true });

      const result = await service.isOptedIn('user-uuid', 'weekly-summary');
      expect(result).toBe(true);
    });

    it('should return false for weekly-summary when opted out', async () => {
      mockRepo.findOne.mockResolvedValue({ ...basePrefs, weeklyEmails: false });

      const result = await service.isOptedIn('user-uuid', 'weekly-summary');
      expect(result).toBe(false);
    });

    it('should default to opted-in when no preferences record exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const achResult = await service.isOptedIn('new-user', 'achievement-unlocked');
      const weeklyResult = await service.isOptedIn('new-user', 'weekly-summary');

      expect(achResult).toBe(true);
      expect(weeklyResult).toBe(true);
    });
  });
});
