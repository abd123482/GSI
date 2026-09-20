import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateEquipmentMovementDTO,
  createEquipmentMovementSchema,
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
        if (serialNumber?.shelfId !== dto.sourceShelfId) {
          throw new BadRequestException('Serial number is not located on the specified source shelf');
        }
      }
    }
  }

  /**
   * Creates a new equipment movement tuple
   */
  async createEquipmentMovement(dto: CreateEquipmentMovementDTO, userId?: string) {
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

    // 6B. Check active inventory locks (prevent movement on scoped items/shelves during active inventory)
    const activeInventories = (await this.prisma.inventory?.findMany?.({
      where: {
        status: { in: ['IN_PROGRESS', 'THIRD_COUNT_REQUIRED'] },
      },
      select: {
        inventoryId: true,
        title: true,
        typeInventory: true,
        equipmentScopeIds: true,
        shelfScopeIds: true,
      },
    })) || [];

    for (const inv of activeInventories) {
      if (inv.typeInventory === 'ByEquipment' && inv.equipmentScopeIds) {
        try {
          const eqIds: string[] = JSON.parse(inv.equipmentScopeIds);
          if (eqIds.includes(validatedData.equipmentId)) {
            throw new BadRequestException(
              `L'article est actuellement sous inventaire actif ("${inv.title || inv.inventoryId}"). Les mouvements de stock sont verrouillés pour cet article jusqu'à finalisation de l'inventaire.`
            );
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
        }
      } else if (inv.typeInventory === 'ByShelf' && inv.shelfScopeIds) {
        try {
          const shIds: string[] = JSON.parse(inv.shelfScopeIds);
          if (
            (validatedData.sourceShelfId && shIds.includes(validatedData.sourceShelfId)) ||
            (validatedData.destinationShelfId && shIds.includes(validatedData.destinationShelfId))
          ) {
            throw new BadRequestException(
              `L'emplacement concerné est actuellement sous inventaire actif ("${inv.title || inv.inventoryId}"). Les mouvements de stock sont verrouillés pour cet emplacement jusqu'à finalisation de l'inventaire.`
            );
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
        }
      }
    }

    // 7. Execute movement, stock update, and serial number updates in a transaction
    return await this.prisma.$transaction(async (tx) => {
      // 7A. If serialized equipment (movement for a specific serial number)
      if (validatedData.serialNumberId) {

        // Source shelf: decrement shelf quantity
        if (validatedData.sourceShelfId) {
          await tx.shelf.update({
            where: { shelfId: validatedData.sourceShelfId },
            data: {
              shelfQuantity: { decrement: 1 },
            },
          });

          const srcEs = await tx.equipmentShelfs.findFirst({
            where: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.sourceShelfId,
            },
          });
          if (srcEs && (srcEs.equipmentQuantity ?? 0) > 0) {
            await tx.equipmentShelfs.update({
              where: { equipmentShelfId: srcEs.equipmentShelfId },
              data: {
                equipmentQuantity: { decrement: 1 },
              },
            });
          }
        }

        // Destination shelf: increment shelf quantity
        if (validatedData.destinationShelfId) {
          await tx.shelf.update({
            where: { shelfId: validatedData.destinationShelfId },
            data: {
              shelfQuantity: { increment: 1 },
            },
          });

          const destEs = await tx.equipmentShelfs.findFirst({
            where: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.destinationShelfId,
            },
          });
          if (destEs) {
            await tx.equipmentShelfs.update({
              where: { equipmentShelfId: destEs.equipmentShelfId },
              data: {
                equipmentQuantity: destEs.equipmentQuantity === null
                  ? 1
                  : { increment: 1 },
              },
            });
          } else {
            await tx.equipmentShelfs.create({
              data: {
                equipmentId: validatedData.equipmentId,
                shelfId: validatedData.destinationShelfId,
                equipmentQuantity: 1,
              },
            });
          }
        }

        // Update serial number location
        await tx.serialNumber.update({
          where: { serialNumberId: validatedData.serialNumberId },
          data: {
            shelfId: validatedData.destinationShelfId ?? null,
          },
        });
      } else {
        // 7B. Standard (non-serialized) equipment
        // If source shelf is provided (Transfer or Exit):
        if (validatedData.sourceShelfId) {
          const sourceEquipmentShelf = await tx.equipmentShelfs.findFirst({
            where: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.sourceShelfId,
            },
            orderBy: { equipmentQuantity: 'desc' },
          });

          if (!sourceEquipmentShelf || (sourceEquipmentShelf.equipmentQuantity ?? 0) < validatedData.movementQuantity) {
            throw new BadRequestException(
              `Insufficient equipment quantity on source shelf. Available: ${sourceEquipmentShelf?.equipmentQuantity ?? 0}, Requested: ${validatedData.movementQuantity}`,
            );
          }

          const sourceUpdate = await tx.equipmentShelfs.updateMany({
            where: {
              equipmentShelfId: sourceEquipmentShelf.equipmentShelfId,
              equipmentQuantity: { gte: validatedData.movementQuantity },
            },
            data: {
              equipmentQuantity: {
                decrement: validatedData.movementQuantity,
              },
            },
          });

          if (sourceUpdate.count === 0) {
            throw new BadRequestException('Source shelf quantity changed; please retry the movement');
          }

          await tx.shelf.update({
            where: { shelfId: validatedData.sourceShelfId },
            data: {
              shelfQuantity: {
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

        // If destination shelf is provided (Transfer or Entry):
        if (validatedData.destinationShelfId) {
          const destinationEquipmentShelf = await tx.equipmentShelfs.findFirst({
            where: {
              equipmentId: validatedData.equipmentId,
              shelfId: validatedData.destinationShelfId,
            },
          });

          if (destinationEquipmentShelf) {
            await tx.equipmentShelfs.update({
              where: { equipmentShelfId: destinationEquipmentShelf.equipmentShelfId },
              data: {
                equipmentQuantity: destinationEquipmentShelf.equipmentQuantity === null
                  ? validatedData.movementQuantity
                  : { increment: validatedData.movementQuantity },
              },
            });
          } else {
            await tx.equipmentShelfs.create({
              data: {
                equipmentId: validatedData.equipmentId,
                shelfId: validatedData.destinationShelfId,
                equipmentQuantity: validatedData.movementQuantity,
              },
            });
          }

          await tx.shelf.update({
            where: { shelfId: validatedData.destinationShelfId },
            data: {
              shelfQuantity: {
                increment: validatedData.movementQuantity,
              },
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
      }

      // 7C. Create movement audit record
      const movement = await tx.mouvement.create({
        data: {
          equipmentId: validatedData.equipmentId,
          serialNumberId: validatedData.serialNumberId,
          sourceShelfId: validatedData.sourceShelfId,
          destinationShelfId: validatedData.destinationShelfId,
          mouvementQuantity: validatedData.movementQuantity,
          mouvementStatus: validatedData.movementType,
          createdAt: new Date(),
          createdByUserId: userId || null,
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
   * Creates batch equipment movements inside a single atomic transaction
   */
  async createBatchEquipmentMovements(items: CreateEquipmentMovementDTO[]) {
    if (!items || !items.length) {
      throw new BadRequestException('At least one movement item must be provided');
    }

    // 1. Validate all items first
    for (const item of items) {
      const validated = createEquipmentMovementSchema.parse(item);
      const equipmentExists = await this.equipmentExists(validated.equipmentId);
      if (!equipmentExists) {
        throw new NotFoundException(`Equipment with ID '${validated.equipmentId}' not found`);
      }
      if (validated.serialNumberId) {
        const snExists = await this.serialNumberExists(validated.serialNumberId);
        if (!snExists) {
          throw new NotFoundException(`Serial number with ID '${validated.serialNumberId}' not found`);
        }
      }
      if (validated.sourceShelfId) {
        const srcExists = await this.shelfExists(validated.sourceShelfId);
        if (!srcExists) {
          throw new NotFoundException(`Source shelf with ID '${validated.sourceShelfId}' not found`);
        }
      }
      if (validated.destinationShelfId) {
        const destExists = await this.shelfExists(validated.destinationShelfId);
        if (!destExists) {
          throw new NotFoundException(`Destination shelf with ID '${validated.destinationShelfId}' not found`);
        }
      }
      await this.validateMovement(validated);
    }

    // 2. Execute all in transaction
    return await this.prisma.$transaction(async (tx) => {
      const movements = [];

      for (const item of items) {
        const validatedData = createEquipmentMovementSchema.parse(item);

        if (validatedData.serialNumberId) {
          // Source shelf decrement
          if (validatedData.sourceShelfId) {
            await tx.shelf.update({
              where: { shelfId: validatedData.sourceShelfId },
              data: { shelfQuantity: { decrement: 1 } },
            });

            const srcEs = await tx.equipmentShelfs.findFirst({
              where: {
                equipmentId: validatedData.equipmentId,
                shelfId: validatedData.sourceShelfId,
              },
            });
            if (srcEs && (srcEs.equipmentQuantity ?? 0) > 0) {
              await tx.equipmentShelfs.update({
                where: { equipmentShelfId: srcEs.equipmentShelfId },
                data: { equipmentQuantity: { decrement: 1 } },
              });
            }
          }

          // Destination shelf increment
          if (validatedData.destinationShelfId) {
            await tx.shelf.update({
              where: { shelfId: validatedData.destinationShelfId },
              data: { shelfQuantity: { increment: 1 } },
            });

            const destEs = await tx.equipmentShelfs.findFirst({
              where: {
                equipmentId: validatedData.equipmentId,
                shelfId: validatedData.destinationShelfId,
              },
            });
            if (destEs) {
              await tx.equipmentShelfs.update({
                where: { equipmentShelfId: destEs.equipmentShelfId },
                data: {
                  equipmentQuantity: destEs.equipmentQuantity === null ? 1 : { increment: 1 },
                },
              });
            } else {
              await tx.equipmentShelfs.create({
                data: {
                  equipmentId: validatedData.equipmentId,
                  shelfId: validatedData.destinationShelfId,
                  equipmentQuantity: 1,
                },
              });
            }
          }

          // Update serial number location
          await tx.serialNumber.update({
            where: { serialNumberId: validatedData.serialNumberId },
            data: {
              shelfId: validatedData.destinationShelfId ?? null,
            },
          });
        }

        const m = await tx.mouvement.create({
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
        movements.push(m);
      }

      return movements;
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
      orderBy: {
        mouvementId: 'asc',
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

}
