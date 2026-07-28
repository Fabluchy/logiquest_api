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
        // Email configuration
        SMTP_HOST: Joi.string().optional().default('localhost'),
        SMTP_PORT: Joi.number().optional().default(587),
        SMTP_SECURE: Joi.string().optional().default('false'),
        SMTP_USER: Joi.string().optional().allow(''),
        SMTP_PASS: Joi.string().optional().allow(''),
        EMAIL_FROM: Joi.string().optional().default('noreply@logiquest.com'),
        // Redis configuration for BullMQ
        REDIS_HOST: Joi.string().optional().default('localhost'),
        REDIS_PORT: Joi.number().optional().default(6379),
        REDIS_PASSWORD: Joi.string().optional().allow(''),
      }),
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
