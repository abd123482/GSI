import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateShelfDTO } from './dto/createShelf.dto.js';
import { UpdateShelfDTO } from './dto/updateShelf.dto.js';
import { PaginationDTO } from './dto/pagination.dto.js';
import { SearchShelfDTO } from './dto/searchShelf.dto.js';

const DEFAULT_STOCK_ID = '606d4178-e0a8-48b9-be6d-9538fa61135a';

@Injectable()
export class ShelfService {
  constructor(private readonly prisma: PrismaService) { }

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

    const targetStockId = dto.stockId ?? DEFAULT_STOCK_ID;

    if (targetStockId) {
      const stockExists = await this.prisma.stock.findUnique({
        where: { stockId: targetStockId },
      });
      if (!stockExists) {
        throw new NotFoundException(`Stock with ID '${targetStockId}' not found`);
      }
    }

    return await this.prisma.shelf.create({
      data: {
        shelfName: dto.shelfName,
        shelfQuantity: 0,
        stockId: targetStockId,
      },
      include: {
        stock: true,
      },
    });
  }

  async getAllShelves(pagination: PaginationDTO) {
    const page = pagination?.page ? Number(pagination.page) : 1;
    const limit = pagination?.limit ? Number(pagination.limit) : 10;
    const skip = (page - 1) * limit;

    const [shelves, totalShelves] = await Promise.all([
      this.prisma.shelf.findMany({
        skip,
        take: limit,
        orderBy: { shelfName: 'asc' },
        include: {
          stock: true,
        },
      }),
      this.prisma.shelf.count(),
    ]);

    return {
      shelves,
      totalShelves,
      totalPages: Math.ceil(totalShelves / limit) || 1,
      currentPage: page,
      limit,
    };
  }

  async getShelfById(pagination: PaginationDTO, id: string) {
    const shelf = await this.prisma.shelf.findUnique({
      where: { shelfId: id },
      include: {
        stock: true,
      },
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
      include: {
        stock: true,
      },
    });
  }

  async searchShelves(searchShelfDTO: SearchShelfDTO, pagination: PaginationDTO) {
    const page = pagination?.page ? Number(pagination.page) : 1;
    const limit = pagination?.limit ? Number(pagination.limit) : 10;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (searchShelfDTO?.shelfName) {
      where.shelfName = {
        contains: searchShelfDTO.shelfName,
      };
    }

    const [shelves, totalShelves] = await Promise.all([
      this.prisma.shelf.findMany({
        skip,
        take: limit,
        where,
        orderBy: { shelfName: 'asc' },
        include: {
          stock: true,
        },
      }),
      this.prisma.shelf.count({ where }),
    ]);

    return {
      shelves,
      totalShelves,
      totalPages: Math.ceil(totalShelves / limit) || 1,
      currentPage: page,
      limit,
    };
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

    if (dto.stockId !== undefined) {
      const stockExists = await this.prisma.stock.findUnique({
        where: { stockId: dto.stockId },
      });
      if (!stockExists) {
        throw new NotFoundException(`Stock with ID '${dto.stockId}' not found`);
      }
    }

    return await this.prisma.shelf.update({
      where: { shelfId: id },
      data: {
        ...(dto.shelfName !== undefined && { shelfName: dto.shelfName }),
        ...(dto.stockId !== undefined && { stockId: dto.stockId }),
      },
      include: {
        stock: true,
      },
    });
  }

  async deleteShelf(id: string) {
    const existingShelf = await this.prisma.shelf.findUnique({
      where: { shelfId: id },
    });
    if (!existingShelf) {
      throw new NotFoundException(`Étagère avec l'identifiant '${id}' introuvable.`);
    }

    // 1. Check if equipment is stored on this shelf
    try {
      const activeEquipment = await this.prisma.equipmentShelfs.findFirst({
        where: {
          shelfId: id,
          equipmentQuantity: { gt: 0 },
        },
      });

      if (activeEquipment) {
        throw new BadRequestException(
          'Impossible de supprimer cette étagère : elle contient encore des équipements en stock.',
        );
      }

      // Clean up any empty equipment-to-shelf mappings (quantity = 0)
      await this.prisma.equipmentShelfs.deleteMany({
        where: { shelfId: id },
      });
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      // If equipmentShelfs query fails for any reason, continue to deletion attempt
    }

    // 2. Perform deletion and gracefully catch foreign key constraints
    try {
      return await this.prisma.shelf.delete({
        where: { shelfId: id },
      });
    } catch (err: any) {
      // Handle foreign key constraint violations from SQL Server (Prisma P2003 or reference constraints)
      if (
        err.code === 'P2003' ||
        err.message?.includes('REFERENCE constraint') ||
        err.message?.includes('foreign key') ||
        err.message?.includes('conflicted with the REFERENCE constraint')
      ) {
        throw new BadRequestException(
          'Impossible de supprimer cette étagère : elle est encore liée à des équipements ou des mouvements dans SQL Server.',
        );
      }
      throw new BadRequestException(
        err.message || 'Erreur lors de la suppression de l’étagère dans SQL Server.',
      );
    }
  }
}