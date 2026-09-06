import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateShelfDTO } from './dto/createShelf.dto.js';
import { UpdateShelfDTO } from './dto/updateShelf.dto.js';
import { PaginationDTO } from './dto/pagination.dto.js';
import { SearchShelfDTO } from './dto/searchShelf.dto.js';

@Injectable()
export class ShelfService {
  constructor(private readonly prisma: PrismaService) {}

  async existShelf(shelfName: string): Promise<boolean> {
    const shelf = await this.prisma.shelf.findFirst({
      where: { shelfName },
    });
    return shelf !== null;
  }

  async createShelf(dto: CreateShelfDTO) {
    const { shelfName } = dto;
    const existingShelf = await this.existShelf(shelfName);
    if (existingShelf) {
      throw new BadRequestException('Shelf already exists');
    }
    return await this.prisma.shelf.create({
      data: {
        shelfName: dto.shelfName,
      },
    });
  }

  async getAllShelves(pagination: PaginationDTO) {
    const { limit = 10, page = 1 } = pagination ?? {};
    const skip = (page - 1) * limit;
    return await this.prisma.shelf.findMany({
      skip,
      take: limit,
      orderBy: { shelfName: 'asc' },
    });
  }

  async getShelfById(pagination: PaginationDTO, id: string) {
    const shelf = await this.prisma.shelf.findUnique({
      where: { shelfId: id },
    });
    if (!shelf) {
      throw new NotFoundException(`Shelf with ID '${id}' not found`);
    }
    return shelf;
  }

  async getShelfByName(pagination: PaginationDTO, shelfName: string) {
    const { limit = 10, page = 1 } = pagination ?? {};
    const skip = (page - 1) * limit;
    return await this.prisma.shelf.findMany({
      skip,
      take: limit,
      where: { shelfName },
      orderBy: { shelfName: 'asc' },
    });
  }

  async searchShelves(searchShelfDTO: SearchShelfDTO, pagination: PaginationDTO) {
    const { limit = 10, page = 1 } = pagination ?? {};
    const skip = (page - 1) * limit;
    const where: any = {};
    if (searchShelfDTO.shelfName) {
      where.shelfName = {
        contains: searchShelfDTO.shelfName,
      };
    }
    return await this.prisma.shelf.findMany({
      skip,
      take: limit,
      where,
      orderBy: { shelfName: 'asc' },
    });
  }

  async updateShelf(dto: UpdateShelfDTO, id: string) {
    const existingShelf = await this.prisma.shelf.findUnique({
      where: { shelfId: id },
    });
    if (!existingShelf) {
      throw new NotFoundException(`Shelf with ID '${id}' not found`);
    }

    if (dto.shelfName && dto.shelfName !== existingShelf.shelfName) {
      const nameTaken = await this.existShelf(dto.shelfName);
      if (nameTaken) {
        throw new BadRequestException('Shelf with this name already exists');
      }
    }

    return await this.prisma.shelf.update({
      where: { shelfId: id },
      data: {
        ...(dto.shelfName !== undefined && { shelfName: dto.shelfName }),
      },
    });
  }

  async deleteShelf(id: string) {
    const existingShelf = await this.prisma.shelf.findUnique({
      where: { shelfId: id },
    });
    if (!existingShelf) {
      throw new NotFoundException(`Shelf with ID '${id}' not found`);
    }
    return await this.prisma.shelf.delete({
      where: { shelfId: id },
    });
  }
}