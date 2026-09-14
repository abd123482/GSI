import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateInventoryDTO } from "./dto/createInventory.dto.js";

@Injectable()
export class InventoryService {
    constructor(private readonly prisma: PrismaService) { }

    async createInventory(data: CreateInventoryDTO) {
        const inventoryType = data.typeInventory;

        // 1. Validate inventory type (supports standard types or existing DB entries)
        const ALLOWED_TYPES = ['ByEquipment', 'ByShelf', 'Global'];
        if (!ALLOWED_TYPES.includes(inventoryType)) {
            const existedInventoryType = await this.prisma.inventory.findFirst({
                where: { typeInventory: inventoryType },
            });
            if (!existedInventoryType) {
                throw new NotFoundException(`inventory type "${inventoryType}" doesn't exist`);
            }
        }

        if (inventoryType === 'ByEquipment') {
            return await this.prisma.$transaction(async (tx) => {
                // 2. Validate shelves upfront (shared by both serial numbers and equipments)
                const targetShelfNames = new Set(data.shelfs ?? []);
                if (data.shelfs && data.shelfs.length > 0) {
                    const existingShelves = await tx.shelf.findMany({
                        where: { shelfName: { in: data.shelfs } },
                    });

                    const allShelfMatches = existingShelves.length === data.shelfs.length;
                    if (!allShelfMatches) {
                        throw new NotFoundException("Une ou plusieurs étagères n'existent pas.");
                    }
                }

                // 3. Create the Inventory record
                const inventory = await tx.inventory.create({
                    data: {
                        typeInventory: inventoryType,
                    },
                });

                // 4. Handle Serial Numbers (check existence, check shelf, link to inventory)
                if (data.serialNumbers && data.serialNumbers.length > 0) {
                    const serialNumbers = data.serialNumbers;

                    const existingSerialNumber = await tx.serialNumber.findMany({
                        where: { serialNumberCode: { in: serialNumbers } },
                        include: {
                            shelf: true,
                            equipment: true,
                        },
                    });

                    // Check if all requested serial numbers exist
                    if (existingSerialNumber.length !== serialNumbers.length) {
                        const foundCodes = new Set(existingSerialNumber.map((s) => s.serialNumberCode));
                        const missing = serialNumbers.filter((code) => !foundCodes.has(code));
                        throw new NotFoundException(`Certains numéros de série n'existent pas: ${missing.join(', ')}`);
                    }

                    // Check if serial numbers are on the specified shelves
                    if (targetShelfNames.size > 0) {
                        const misplaced = existingSerialNumber.filter(
                            (s) => !s.shelf?.shelfName || !targetShelfNames.has(s.shelf.shelfName)
                        );
                        if (misplaced.length > 0) {
                            const details = misplaced
                                .map((s) => `${s.serialNumberCode} (étagère: ${s.shelf?.shelfName ?? 'aucune'})`)
                                .join(', ');
                            throw new BadRequestException(
                                `Certains numéros de série ne se trouvent pas dans les étagères spécifiées: ${details}`
                            );
                        }
                    }

                    // Link to Inventory_SerialNumber
                    await tx.inventory_SerialNumber.createMany({
                        data: existingSerialNumber.map((s) => ({
                            inventoryId: inventory.inventoryId,
                            serialNumberId: s.serialNumberId,
                        })),
                    });
                }

                // 5. Handle Equipments (verify existence, verify shelves, save counted quantity)
                if (data.equipments && data.equipments.length > 0) {
                    const equipments = data.equipments;

                    const existingEquipments = await tx.equipment.findMany({
                        where: {
                            equipmentName: { in: equipments },
                        },
                        include: {
                            equipmentShelfs: {
                                include: { shelf: true },
                            },
                            serialNumbers: {
                                include: { shelf: true },
                            },
                        },
                    });

                    if (existingEquipments.length !== equipments.length) {
                        const foundNames = new Set(existingEquipments.map((e) => e.equipmentName));
                        const missing = equipments.filter((name) => !foundNames.has(name));
                        throw new NotFoundException(`Certains équipements n'existent pas: ${missing.join(', ')}`);
                    }

                    if (targetShelfNames.size > 0) {
                        const shelfsMatches = existingEquipments.every((eq) => {
                            const shelfNames = eq.hasSerialNumber
                                ? eq.serialNumbers.map((s) => s.shelf?.shelfName).filter(Boolean)
                                : eq.equipmentShelfs.map((es) => es.shelf?.shelfName).filter(Boolean);

                            return shelfNames.length > 0 && shelfNames.every((name) => targetShelfNames.has(name!));
                        });

                        if (!shelfsMatches) {
                            throw new BadRequestException("Certains équipements ne se trouvent pas dans les étagères spécifiées.");
                        }
                    }

                    // Link to Inventory_Equipment with counted quantity
                    for (const eq of existingEquipments) {
                        const totalRecordedQty = eq.equipmentShelfs.reduce(
                            (sum, es) => sum + (es.equipmentQuantity ?? 0),
                            0
                        );
                        const countedQuantity = data.amount !== undefined ? data.amount : totalRecordedQty;

                        await tx.inventory_Equipment.create({
                            data: {
                                inventoryId: inventory.inventoryId,
                                equipmentId: eq.equipmentId,
                                countedQuantity,
                            },
                        });
                    }
                }

                // 6. Return response
                return {
                    message: "Inventaire créé avec succès.",
                    inventoryId: inventory.inventoryId,
                    typeInventory: inventory.typeInventory,
                    createdAt: inventory.createdAt,
                    shelfs: data.shelfs ?? [],
                    serialNumbersCount: data.serialNumbers?.length ?? 0,
                    equipmentsCount: data.equipments?.length ?? 0,
                };
            });
        }

        throw new BadRequestException(`Le type d'inventaire "${inventoryType}" n'est pas encore pris en charge.`);
    }
}
