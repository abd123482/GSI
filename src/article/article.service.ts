import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { Article } from "./entities/article.entity.js";
import { Repository } from "typeorm";
import { GettingArticleDTO } from "./dto/getting-article.dto.js";
import { articlestatus } from "./enums/article.enum.js";
import { error } from "node:console";
import { BadRequestException } from "@nestjs/common";
@Injectable()
export class ArticleService{
      constructor(
    @InjectRepository(Article)
    private userRepository: Repository<Article>,
  ) {}

async getAllArticles(){
return await this.userRepository.find();
}

async getArticleById(Id:number){
    return await this.userRepository.findOne({
          where: { articleId: Id }
    })
}

async getProductByInfo(dto?:GettingArticleDTO){
    return await this.userRepository.findBy({
       articleName:dto?.name,
       hasSerialNumber:dto?.hasSerialNumber,
       articlestatus:dto?.articlestatus,
       createdAt:dto?.createdAt,
       quantity_article:dto?.quantity_article,
       modifiedAt:dto?.modifiedAt
    })
}

async createArticle(dto?: GettingArticleDTO) {
    try{
      const article = this.userRepository.create({
      articleName: dto?.name || '', // Provide default if needed
      hasSerialNumber: dto?.hasSerialNumber || false,
      articlestatus: dto?.articlestatus || articlestatus.AVAILABLE,
      quantity_article: dto?.quantity_article || 0,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });

    return await this.userRepository.save(article);
    }
    catch(error){
    throw new BadRequestException(`Failed to create article: ${error}`);

    }
  }
async deleteArticleById(id:number){
     try{
     return  await this.userRepository.delete(id)
     }
     catch(error){
      throw new NotFoundException("article doesn't exist");
     }

}

}