import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const email = 'abdkkassl@gmail.com';
  
  console.log(`Looking for user with email: ${email}`);
  const user = await prisma.user.findFirst({
    where: { userEmail: email }
  });
  
  if (!user) {
    console.log('User not found!');
    process.exit(1);
  }
  
  console.log(`Found user: ${user.userId}`);
  
  let role = await prisma.role.findFirst({
    where: { roleName: 'ADMIN' }
  });
  
  if (!role) {
    console.log('ADMIN role not found, creating it...');
    role = await prisma.role.create({
      data: { roleName: 'ADMIN' }
    });
  }
  
  await prisma.user.update({
    where: { userId: user.userId },
    data: { 
      roleId: role.roleId,
      userStatus: 'ACTIVE'
    }
  });
  
  console.log(`Successfully granted ADMIN role to ${email}`);
  await app.close();
}

bootstrap().catch(console.error);
