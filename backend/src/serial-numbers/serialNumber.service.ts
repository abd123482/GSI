import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateSerialNumberDTO,
  createSerialNumberSchema,
  UpdateSerialNumberDTO,
  updateSerialNumberSchema,
  UpdateSerialNumberStatusDTO,
  updateSerialNumberStatusSchema,
  PaginationDTO
} from './dto/index.js';

@Injectable()
export class SerialNumberService {
  constructor(private readonly prisma: PrismaService) { }

  async serialNumberExists(serialNumberCode: string, dto: PaginationDTO): Promise<boolean> {
    const { limit, page } = dto;
    const skip = (page - 1) * limit;
    const totalSerialNumber = await this.prisma.serialNumber.count({ where: { serialNumberCode } });
    return totalSerialNumber > 0;
  }

  async createSerialNumber(
    serialNumberdto: CreateSerialNumberDTO
  ): Promise<void> {
    const existingSerialNumber = await this.serialNumberExists(serialNumberdto.serialNumberCode, { limit: 10, page: 1 });

    if (existingSerialNumber) {
      throw new BadRequestException('Serial number already exists');
    }

    await this.prisma.serialNumber.create({
      data: serialNumberdto,
    });

  }

  async getAllSerialNumbers(paginationdto: PaginationDTO) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
    })
  }

  async getSerialNumberById(paginationdto: PaginationDTO, id: string) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
      where: { serialNumberId: id }
    })
  }

  async getSerialNumberByCode(paginationdto: PaginationDTO, serialNumberCode: string) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
      where: { serialNumberCode }
    })
  }


  async updateSerialNumber(serialNumberdto: UpdateSerialNumberDTO, id: string) {
    const existingSerialNumber = await this.serialNumberExists(serialNumberdto.serialNumberCode!, { limit: 10, page: 1 });

    if (!existingSerialNumber) {
      throw new BadRequestException('Serial number does not exist');
    }

    await this.prisma.serialNumber.update({
      where: { serialNumberId: id },
      data: serialNumberdto,
    })
  }

  async getSerialNumberByStatus(paginationdto: PaginationDTO, serialNumberStatus: string) {
    const { limit, page } = paginationdto;
    const skip = (page - 1) * limit;
    return await this.prisma.serialNumber.findMany({
      skip,
      take: limit,
      where: { serialNumberStatus }
    })
  }


  async updateSerialNumberStatus(id: string, dto: UpdateSerialNumberStatusDTO) {
    const existingSerialNumber = await this.serialNumberExists(id, { limit: 10, page: 1 });

    if (!existingSerialNumber) {
      throw new BadRequestException('Serial number does not exist');
    }

    await this.prisma.serialNumber.update({
      where: { serialNumberId: id },
      data: { serialNumberStatus: dto.serialNumberStatus }
    })
  }

  async deleteSerialNumber(id: string) {
    const existingSerialNumber = await this.serialNumberExists(id, { limit: 10, page: 1 });

    if (!existingSerialNumber) {
      throw new BadRequestException('Serial number does not exist');
    }

    await this.prisma.serialNumber.delete({
      where: { serialNumberId: id },
    })
  }

  async insertSerialNumberToShelf(serialNumberId: string, shelfId: string) {
    const existingSerialNumber = await this.serialNumberExists(serialNumberId, { limit: 10, page: 1 });

    if (!existingSerialNumber) {
      throw new BadRequestException('Serial number does not exist');
    }

    const existingShelf = await this.prisma.shelf.findUnique({
      where: { shelfId },
    });

    if (!existingShelf) {
      throw new BadRequestException('Shelf does not exist');
    }

    await this.prisma.serialNumber.update({
      where: { serialNumberId },
      data: { shelfId }
    })
  }
}

