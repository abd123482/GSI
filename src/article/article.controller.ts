import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ArticleService } from './article.service.js';
import { Article } from './entities/article.entity.js';
import { GettingArticleDTO } from './dto/getting-article.dto.js';
@Controller('article')
@UseInterceptors(ClassSerializerInterceptor)
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService
  ) {}

  // GET /article
@Get()
@HttpCode(HttpStatus.OK)
async getAllArticles(): Promise<Article[]> {
  console.log('✅ GET ALL ARTICLES CONTROLLER');

  const result = await this.articleService.getAllArticles();

  console.log('RESULT:', result);

  return result;
}

  // GET /article/search
  // IMPORTANT: before :id
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async getArticleByInfo(
    @Query() dto: GettingArticleDTO
  ): Promise<Article[]> {
    return this.articleService.getProductByInfo(dto);
  }

  // GET /article/1
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getArticleById(
    @Param('id', ParseIntPipe) id: number
  ): Promise<Article> {

    const article =
      await this.articleService.getArticleById(id);

    if (!article) {
      throw new NotFoundException(
        `Article with ID ${id} not found`
      );
    }

    return article;
  }

  // POST /article
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createArticle(
    @Body() dto: GettingArticleDTO
  ): Promise<Article> {

    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException(
        'Article name is required'
      );
    }

    return this.articleService.createArticle(dto);
  }

  // DELETE /article/1
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArticle(
    @Param('id', ParseIntPipe) id: number
  ): Promise<void> {

    const article =
      await this.articleService.getArticleById(id);

    if (!article) {
      throw new NotFoundException(
        `Article with ID ${id} not found`
      );
    }

    await this.articleService.deleteArticleById(id);
  }
}