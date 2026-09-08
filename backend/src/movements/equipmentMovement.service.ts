import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateEquipmentMovementDTO,
  createEquipmentMovementSchema,
  CreateEntryMovementWithEquipmentDTO,
  createEntryMovementWithEquipmentSchema,
  SearchEquipmentMovementDTO,
  searchEquipmentMovementSchema,
  PaginationDTO,
} from './dto/index.js';

@Injectable()
export class EquipmentMovementService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Checks if an equipment with the given ID exists
   */
  async equipmentExists(equipmentId: string): Promise<boolean> {
    if (!equipmentId || typeof equipmentId !== 'string' || equipmentId.trim() === '') {
      return false;
    }
    const count = await this.prisma.equipment.count({
      where: { equipmentId: equipmentId.trim() },
    });
    return count > 0;
  }

  /**
   * Checks if a serial number with the given ID exists
   */
  async serialNumberExists(serialNumberId: string): Promise<boolean> {
    if (!serialNumberId || typeof serialNumberId !== 'string' || serialNumberId.trim() === '') {
      return false;
    }
    const count = await this.prisma.serialNumber.count({
      where: { serialNumberId: serialNumberId.trim() },
    });
    return count > 0;
  }

  /**
   * Checks if a shelf with the given ID exists
   */
  async shelfExists(shelfId: string): Promise<boolean> {
    if (!shelfId || typeof shelfId !== 'string' || shelfId.trim() === '') {
      return false;
    }
    const count = await this.prisma.shelf.count({
      where: { shelfId: shelfId.trim() },
    });
    return count > 0;
  }

  /**
   * Checks if an equipment movement with the given ID exists
   */
  async equipmentMovementExists(movementId: string): Promise<boolean> {
    if (!movementId || typeof movementId !== 'string' || movementId.trim() === '') {
      return false;
    }
    const count = await this.prisma.mouvement.count({
      where: { mouvementId: movementId.trim() },
    });
    return count > 0;
  }

  /**
   * Validates business rules of a movement
   */
  async validateMovement(dto: CreateEquipmentMovementDTO): Promise<void> {
    if (dto.movementQuantity <= 0) {
      throw new BadRequestException('Movement quantity must be greater than 0');
    }

    if (!dto.sourceShelfId && !dto.destinationShelfId) {
      throw new BadRequestException('At least one of source shelf or destination shelf must be provided');
    }

    if (dto.sourceShelfId && dto.destinationShelfId && dto.sourceShelfId === dto.destinationShelfId) {
      throw new BadRequestException('Source shelf and destination shelf cannot be the same');
    }

    // If serialized equipment
    if (dto.serialNumberId) {
      if (dto.movementQuantity !== 1) {
        throw new BadRequestException('Movement quantity for serialized equipment must be 1');
      }

      if (dto.sourceShelfId) {
        const serialNumber = await this.prisma.serialNumber.findUnique({
          where: { serialNumberId: dto.serialNumberId },
        });
        if (serialNumber?.shelfId && serialNumber.shelfId !== dto.sourceShelfId) {
          throw new BadRequestException('Serial number is not located on the specified source shelf');
        }
      }
    }
  }

  /**
   * Creates a new equipment movement tuple
   */
  async createEquipmentMovement(dto: CreateEquipmentMovementDTO) {
    // 1. Validate inputs of creating a new equipment movement from CreateEquipmentMovementDTO
    const validatedData = createEquipmentMovementSchema.parse(dto);

    // 2. Check if the equipment exists using equipmentExists()
    const equipmentExists = await this.equipmentExists(validatedData.equipmentId);
    if (!equipmentExists) {
      throw new NotFoundException(`Equipment with ID '${validatedData.equipmentId}' not found`);
    }

    // 3. If serialNumberId is provided: check if the serial number exists and belongs to equipment
    if (validatedData.serialNumberId) {
      const serialNumberExists = await this.serialNumberExists(validatedData.serialNumberId);
      if (!serialNumberExists) {
        throw new NotFoundException(`Serial number with ID '${validatedData.serialNumberId}' not found`);
      }

      const serialNumber = await this.prisma.serialNumber.findUnique({
        where: { serialNumberId: validatedData.serialNumberId },
      });

      if (serialNumber?.equipmentId !== validatedData.equipmentId) {
        throw new BadRequestException('Serial number does not belong to the specified equipment');
      }
    }

    // 4. If sourceShelfId is provided: check if the source shelf exists using shelfExists()
    if (validatedData.sourceShelfId) {
      const sourceShelfExists = await this.shelfExists(validatedData.sourceShelfId);
      if (!sourceShelfExists) {
        throw new NotFoundException(`Source shelf with ID '${validatedData.sourceShelfId}' not found`);
      }
    }

    // 5. If destinationShelfId is provided: check if the destination shelf exists using shelfExists()
    if (validatedData.destinationShelfId) {
      const destinationShelfExists = await this.shelfExists(validatedData.destinationShelfId);
      if (!destinationShelfExists) {
        throw new NotFoundException(`Destination shelf with ID '${validatedData.destinationShelfId}' not found`);
      }
    }

    // 6. Validate movement business rules
    await this.validateMovement(validatedData);

    // 7. Execute movement, stock update, and serial number updates in a transaction
    return await this.prisma.$transaction(async (tx) => {
      // 7a. If source shelf is provided (Transfer or Exit):
      if (validatedData.sourceShelfId) {
        const sourceEquipmentShelf = await tx.equipmentShelfs.findUnique({
          where: {
            equipmentId_shelfId: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.sourceShelfId,
            },
          },
        });

        if (!sourceEquipmentShelf || sourceEquipmentShelf.equipmentQuantity < validatedData.movementQuantity) {
          throw new BadRequestException(
            `Insufficient equipment quantity on source shelf. Available: ${sourceEquipmentShelf?.equipmentQuantity ?? 0}, Requested: ${validatedData.movementQuantity}`,
          );
        }

        await tx.equipmentShelfs.update({
          where: {
            equipmentId_shelfId: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.sourceShelfId,
            },
          },
          data: {
            equipmentQuantity: {
              decrement: validatedData.movementQuantity,
            },
          },
        });

        // If pure exit (no destination shelf), decrement total equipment quantity
        if (!validatedData.destinationShelfId) {
          await tx.equipment.update({
            where: { equipmentId: validatedData.equipmentId },
            data: {
              equipmentQuantity: {
                decrement: validatedData.movementQuantity,
              },
            },
          });
        }
      }

      // 7b. If destination shelf is provided (Transfer or Entry):
      if (validatedData.destinationShelfId) {
        await tx.equipmentShelfs.upsert({
          where: {
            equipmentId_shelfId: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.destinationShelfId,
            },
          },
          update: {
            equipmentQuantity: {
              increment: validatedData.movementQuantity,
            },
          },
          create: {
            equipmentId: validatedData.equipmentId,
            shelfId: validatedData.destinationShelfId,
            equipmentQuantity: validatedData.movementQuantity,
          },
        });

        // If pure entry (no source shelf), increment total equipment quantity
        if (!validatedData.sourceShelfId) {
          await tx.equipment.update({
            where: { equipmentId: validatedData.equipmentId },
            data: {
              equipmentQuantity: {
                increment: validatedData.movementQuantity,
              },
            },
          });
        }
      }

      // 7c. Update serial number location if provided
      if (validatedData.serialNumberId) {
        await tx.serialNumber.update({
          where: { serialNumberId: validatedData.serialNumberId },
          data: {
            shelfId: validatedData.destinationShelfId ?? null,
          },
        });
      }

      // 7d. Create movement audit record
      const movement = await tx.mouvement.create({
        data: {
          equipmentId: validatedData.equipmentId,
          serialNumberId: validatedData.serialNumberId,
          sourceShelfId: validatedData.sourceShelfId,
          destinationShelfId: validatedData.destinationShelfId,
          mouvementQuantity: validatedData.movementQuantity,
          mouvementStatus: validatedData.movementType,
        },
        include: {
          equipment: true,
          serialNumber: true,
          sourceShelf: true,
          destinationShelf: true,
        },
      });

      return movement;
    });
  }

  /**
   * Finds and returns all tuples of EquipmentMovement schema with pagination
   */
  async getAllEquipmentMovements(pagination: PaginationDTO) {
    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
      orderBy: {
        mouvementId: 'desc',
      },
    });
  }

  /**
   * Searches for equipment movement tuples that match the searching options with pagination
   */
  async searchEquipmentMovements(dto: SearchEquipmentMovementDTO, pagination: PaginationDTO) {
    const validatedData = searchEquipmentMovementSchema.parse(dto);
    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (validatedData.equipmentId) where.equipmentId = validatedData.equipmentId;
    if (validatedData.serialNumberId) where.serialNumberId = validatedData.serialNumberId;
    if (validatedData.sourceShelfId) where.sourceShelfId = validatedData.sourceShelfId;
    if (validatedData.destinationShelfId) where.destinationShelfId = validatedData.destinationShelfId;
    if (validatedData.movementQuantity !== undefined) where.mouvementQuantity = validatedData.movementQuantity;
    if (validatedData.movementType) where.mouvementStatus = validatedData.movementType;

    return await this.prisma.mouvement.findMany({
      where,
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Validates movement ID input, checks existence, and returns the complete tuple
   */
  async getEquipmentMovementById(pagination: PaginationDTO, id: string) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException('Movement ID is required');
    }

    const exists = await this.equipmentMovementExists(id.trim());
    if (!exists) {
      throw new NotFoundException(`Equipment movement with ID '${id}' not found`);
    }

    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      where: { mouvementId: id.trim() },
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Validates movement type input and returns all tuples that have the specified movement type with pagination
   */
  async getMovementsByType(pagination: PaginationDTO, type: string) {
    if (!type || typeof type !== 'string' || type.trim() === '') {
      throw new BadRequestException('Movement type is required');
    }

    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      where: {
        mouvementStatus: type.trim(),
      },
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Validates equipment ID input, checks existence, and returns all movements for that equipment with pagination
   */
  async getMovementsByEquipmentId(pagination: PaginationDTO, equipmentId: string) {
    if (!equipmentId || typeof equipmentId !== 'string' || equipmentId.trim() === '') {
      throw new BadRequestException('Equipment ID is required');
    }

    const exists = await this.equipmentExists(equipmentId.trim());
    if (!exists) {
      throw new NotFoundException(`Equipment with ID '${equipmentId}' not found`);
    }

    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      where: {
        equipmentId: equipmentId.trim(),
      },
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Validates serial number ID input, checks existence, and returns all movements for that serial number with pagination
   */
  async getMovementsBySerialNumberId(pagination: PaginationDTO, serialNumberId: string) {
    if (!serialNumberId || typeof serialNumberId !== 'string' || serialNumberId.trim() === '') {
      throw new BadRequestException('Serial number ID is required');
    }

    const exists = await this.serialNumberExists(serialNumberId.trim());
    if (!exists) {
      throw new NotFoundException(`Serial number with ID '${serialNumberId}' not found`);
    }

    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      where: {
        serialNumberId: serialNumberId.trim(),
      },
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Validates shelf ID input, checks existence, and returns all movements where this shelf is the source shelf with pagination
   */
  async getMovementsBySourceShelfId(pagination: PaginationDTO, shelfId: string) {
    if (!shelfId || typeof shelfId !== 'string' || shelfId.trim() === '') {
      throw new BadRequestException('Shelf ID is required');
    }

    const exists = await this.shelfExists(shelfId.trim());
    if (!exists) {
      throw new NotFoundException(`Shelf with ID '${shelfId}' not found`);
    }

    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      where: {
        sourceShelfId: shelfId.trim(),
      },
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Validates shelf ID input, checks existence, and returns all movements where this shelf is the destination shelf with pagination
   */
  async getMovementsByDestinationShelfId(pagination: PaginationDTO, shelfId: string) {
    if (!shelfId || typeof shelfId !== 'string' || shelfId.trim() === '') {
      throw new BadRequestException('Shelf ID is required');
    }

    const exists = await this.shelfExists(shelfId.trim());
    if (!exists) {
      throw new NotFoundException(`Shelf with ID '${shelfId}' not found`);
    }

    const { limit = 10, page = 1 } = pagination;
    const skip = (page - 1) * limit;

    return await this.prisma.mouvement.findMany({
      where: {
        destinationShelfId: shelfId.trim(),
      },
      skip,
      take: limit,
      include: {
        equipment: true,
        serialNumber: true,
        sourceShelf: true,
        destinationShelf: true,
      },
    });
  }

  /**
   * Creates equipment and optional serial numbers directly in an ENTRY movement.
   * - Sets movement source shelf to null.
   * - Destination shelf can be null (unassigned) or a specific shelf.
   * - Guarantees serial number uniqueness across the system.
   */
  async createEntryMovementWithEquipment(dto: CreateEntryMovementWithEquipmentDTO) {
    const validated = createEntryMovementWithEquipmentSchema.parse(dto);

    // 1. Check if equipment with the same name already exists
    const existingEquipment = await this.prisma.equipment.findFirst({
      where: { equipmentName: validated.equipmentName },
    });
    if (existingEquipment) {
      throw new BadRequestException(
        `Un équipement nommé '${validated.equipmentName}' existe déjà dans le système.`,
      );
    }

    // 2. Check destination shelf if specified (can be null/unassigned)
    if (validated.destinationShelfId) {
      const shelfExists = await this.shelfExists(validated.destinationShelfId);
      if (!shelfExists) {
        throw new NotFoundException(
          `L'étagère de destination avec l'identifiant '${validated.destinationShelfId}' est introuvable.`,
        );
      }
    }

    // 3. If serialized, check uniqueness of all serial number codes in the database
    if (validated.hasSerialNumber && validated.serialNumbers && validated.serialNumbers.length > 0) {
      const existingSerials = await this.prisma.serialNumber.findMany({
        where: {
          serialNumberCode: {
            in: validated.serialNumbers,
          },
        },
        select: { serialNumberCode: true },
      });

      if (existingSerials.length > 0) {
        const dupes = existingSerials.map((s) => s.serialNumberCode).join(', ');
        throw new BadRequestException(
          `Les numéros de série suivants existent déjà dans la base de données : ${dupes}`,
        );
      }
    }

    // 4. Perform atomic transactional creation
    return await this.prisma.$transaction(async (tx) => {
      // 4a. Create the Equipment tuple
      const equipment = await tx.equipment.create({
        data: {
          equipmentName: validated.equipmentName,
          hasSerialNumber: validated.hasSerialNumber,
          equipmentQuantity: validated.equipmentQuantity,
          minequipmentQuantity: validated.minEquipmentQuantity ?? 0,
        },
      });

      // 4b. Create SerialNumber tuples if serialized
      const createdSerialNumbers = [];
      if (validated.hasSerialNumber && validated.serialNumbers) {
        for (const code of validated.serialNumbers) {
          const sn = await tx.serialNumber.create({
            data: {
              serialNumberCode: code,
              serialNumberStatus: 'AVAILABLE',
              equipmentId: equipment.equipmentId,
              shelfId: validated.destinationShelfId ?? null,
            },
          });
          createdSerialNumbers.push(sn);
        }
      }

      // 4c. Update or insert EquipmentShelfs if destination shelf is assigned
      if (validated.destinationShelfId) {
        await tx.equipmentShelfs.upsert({
          where: {
            equipmentId_shelfId: {
              equipmentId: equipment.equipmentId,
              shelfId: validated.destinationShelfId,
            },
          },
          update: {
            equipmentQuantity: {
              increment: validated.equipmentQuantity,
            },
          },
          create: {
            equipmentId: equipment.equipmentId,
            shelfId: validated.destinationShelfId,
            equipmentQuantity: validated.equipmentQuantity,
          },
        });
      }

      // 4d. Record the ENTRY movement tuple (sourceShelfId is null, destinationShelfId nullable)
      const movement = await tx.mouvement.create({
        data: {
          equipmentId: equipment.equipmentId,
          sourceShelfId: null, // As specified: movement source is null!
          destinationShelfId: validated.destinationShelfId ?? null, // Can be null if not assigned directly to a shelf
          mouvementQuantity: validated.equipmentQuantity,
          mouvementStatus: validated.movementStatus || 'ENTRY',
        },
      });

      return {
        movement,
        equipment: {
          ...equipment,
          serialNumbers: createdSerialNumbers,
        },
      };
    });
  }
}

