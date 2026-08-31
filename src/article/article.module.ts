import { Module } from "@nestjs/common";
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from "../auth/user/entities/user.entity.js";
import { Article } from "./entities/article.entity.js";
import { ArticleService } from "./article.service.js";
import { ArticleController } from "./article.controller.js";
@Module({
      imports: [TypeOrmModule.forFeature([Article])], 
      providers : [ArticleService],
      controllers : [ArticleController],
      exports: [ArticleService]
})
export class ArticleModule{}
