import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { PrismaService } from './src/prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  try {
    const res = await prisma.mouvement.findMany({
      take: 1,
      include: {
        sourceShelf: true,
      },
    });
    console.log('SUCCESS:', res.length);
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await app.close();
  }
}

bootstrap();
