import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module.js';
import { ArticleModule } from './article/article.module.js';
import { Article } from './article/entities/article.entity.js';
import { Emplacement } from './emplacement/entities/emplacement.entity.js';
import { Mouvement } from './mouvement/entities/mouvement.entity.js';
import { SerialNumber } from './serialNumber/entities/serialNumber.entity.js';
import { Site } from './site/entities/site.entity.js';
import { Stock } from './stock/entities/stock.entity.js';

const databaseEntities = [
  Article,
  Emplacement,
  Mouvement,
  SerialNumber,
  Site,
  Stock,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    ArticleModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        type: 'mssql',

        host: configService.get<string>('DB_HOST'),

        username:
          configService.get<string>('DB_USERNAME'),

        password:
          configService.get<string>('DB_PASSWORD'),

        database:
          configService.get<string>('DB_DATABASE'),

        entities: databaseEntities,

        autoLoadEntities: true,

        synchronize: false,

        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      }),
    }),
  ],
})
export class AppModule {}
