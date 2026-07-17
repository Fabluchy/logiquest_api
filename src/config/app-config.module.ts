import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRY: Joi.string().required(),
        PORT: Joi.number().required(),

        // Redis (used by BullMQ for the email job queue)
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().optional().allow(''),

        // Email transport
        EMAIL_PROVIDER: Joi.string().valid('smtp', 'sendgrid').default('smtp'),
        EMAIL_FROM: Joi.string().email().default('noreply@logiquest.app'),

        // SMTP settings (used when EMAIL_PROVIDER=smtp)
        SMTP_HOST: Joi.string().default('localhost'),
        SMTP_PORT: Joi.number().default(587),
        SMTP_SECURE: Joi.boolean().default(false),
        SMTP_USER: Joi.string().optional().allow(''),
        SMTP_PASS: Joi.string().optional().allow(''),

        // SendGrid API key (used when EMAIL_PROVIDER=sendgrid)
        SENDGRID_API_KEY: Joi.string().optional().allow(''),
      }),
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
