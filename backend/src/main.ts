import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

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
  const adapter = new FastifyAdapter({
    bodyLimit: 50 * 1024 * 1024, // 50mb
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    rawBody: true,
  });

  // Enable generous payload limits (50mb) for bulk counting and serial number audits
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
// Trigger restart
// Trigger restart 2
// Trigger restart 3
