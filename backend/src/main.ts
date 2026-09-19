import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { json, urlencoded } from 'express';

function validateEnvironment() {
  const logger = new Logger('EnvironmentValidator');
  const requiredEnvVars = [
    'CLERK_SECRET_KEY',
    'CLERK_JWT_KEY',
    'FRONTEND_URL',
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(
      `FATAL: Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Please check your .env file or deployment configuration before starting the application.`,
    );
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnvironment();

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  // Enable generous payload limits (50mb) for bulk counting and serial number audits
  app.use(
    json({
      limit: '50mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: '50mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');

  logger.log(`NestJS application successfully running on http://localhost:${port}`);
  logger.log(`CORS enabled for: ${frontendUrl}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Failed to start application', err);
  process.exit(1);
});
