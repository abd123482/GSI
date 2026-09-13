import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { EquipmentMovementService } from './equipmentMovement.service.js';
import { EquipmentService } from '../equipment/equipment.service.js';
import { SerialNumberService } from '../serial-numbers/serialNumber.service.js';
import 'dotenv/config';

describe('Equipment Lifecycle & Movements Decoupled Flow', () => {
  const adapter = new PrismaMssql({
    server: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

  const prisma = new PrismaClient({ adapter }) as any;
  const movementService = new EquipmentMovementService(prisma);
  const equipmentService = new EquipmentService(prisma);
  const serialNumberService = new SerialNumberService(prisma);

  it('should create equipment, generate serial numbers, and track movements with strict shelf stock isolation', async () => {
    const timestamp = Date.now();
    const sn1 = `SN-32BIT-${timestamp}-1`;
    const sn2 = `SN-32BIT-${timestamp}-2`;

    // 1. Create a dedicated test shelf (shelfQuantity initialized to 0)
    const shelf1 = await prisma.shelf.create({
      data: {
        shelfName: `Test-Shelf-A-${timestamp}`,
        shelfQuantity: 0,
      },
    });
    expect(shelf1.shelfQuantity).toBe(0);

    const shelf2 = await prisma.shelf.create({
      data: {
        shelfName: `Test-Shelf-B-${timestamp}`,
        shelfQuantity: 0,
      },
    });
    expect(shelf2.shelfQuantity).toBe(0);

    // 2. Create serialized equipment via EquipmentService
    const equipment = await equipmentService.createEquipment({
      equipmentName: `Equip-Test-${timestamp}`,
      hasSerialNumber: true,
      equipmentQuantity: 0,
      minEquipmentQuantity: 1,
    });
    expect(equipment).toBeDefined();
    expect(equipment.equipmentName).toBe(`Equip-Test-${timestamp}`);
    expect(equipment.hasSerialNumber).toBe(true);

    // 3. Batch create serial numbers via SerialNumberService
    const batchResult = await serialNumberService.createBatchSerialNumbers({
      equipmentId: equipment.equipmentId,
      serialNumberCodes: [sn1, sn2],
    });
    expect(batchResult.success).toBe(true);
    expect(batchResult.count).toBe(2);

    // Equipment quantity should now be 2
    const equipWithSerials = await equipmentService.getEquipmentById(equipment.equipmentId);
    expect(equipWithSerials.equipmentQuantity).toBe(2);
    expect(equipWithSerials.serialNumbers.length).toBe(2);

    const serialItem1 = equipWithSerials.serialNumbers.find((s: any) => s.serialNumberCode === sn1);
    const serialItem2 = equipWithSerials.serialNumbers.find((s: any) => s.serialNumberCode === sn2);
    expect(serialItem1).toBeDefined();
    expect(serialItem2).toBeDefined();

    // 4. Record ENTRY movement for serialItem1 into shelf1
    const entryMovement = await movementService.createEquipmentMovement({
      equipmentId: equipment.equipmentId,
      serialNumberId: serialItem1.serialNumberId,
      sourceShelfId: null,
      destinationShelfId: shelf1.shelfId,
      movementQuantity: 1,
      movementType: 'ENTRY',
    });
    expect(entryMovement).toBeDefined();
    expect(entryMovement.mouvementStatus).toBe('ENTRY');

    // Verify shelf1 quantity incremented to 1 strictly through movement
    const updatedShelf1 = await prisma.shelf.findUnique({ where: { shelfId: shelf1.shelfId } });
    expect(updatedShelf1.shelfQuantity).toBe(1);

    // Verify serialItem1 is now located on shelf1
    const updatedSerial1 = await prisma.serialNumber.findUnique({
      where: { serialNumberId: serialItem1.serialNumberId },
    });
    expect(updatedSerial1.shelfId).toBe(shelf1.shelfId);

    // 5. Record TRANSFER movement from shelf1 to shelf2
    const transferMovement = await movementService.createEquipmentMovement({
      equipmentId: equipment.equipmentId,
      serialNumberId: serialItem1.serialNumberId,
      sourceShelfId: shelf1.shelfId,
      destinationShelfId: shelf2.shelfId,
      movementQuantity: 1,
      movementType: 'TRANSFER',
    });
    expect(transferMovement).toBeDefined();
    expect(transferMovement.mouvementStatus).toBe('TRANSFER');

    // Verify shelf1 decremented to 0 and shelf2 incremented to 1
    const shelf1AfterTransfer = await prisma.shelf.findUnique({ where: { shelfId: shelf1.shelfId } });
    const shelf2AfterTransfer = await prisma.shelf.findUnique({ where: { shelfId: shelf2.shelfId } });
    expect(shelf1AfterTransfer.shelfQuantity).toBe(0);
    expect(shelf2AfterTransfer.shelfQuantity).toBe(1);

    // 6. Test modifying a serial number (code and status)
    const updatedSnCode = `SN-MODIFIED-${timestamp}`;
    const updatedSn = await serialNumberService.updateSerialNumber(
      {
        serialNumberCode: updatedSnCode,
        serialNumberStatus: 'IN_USE',
      },
      serialItem2.serialNumberId,
    );
    expect(updatedSn.serialNumberCode).toBe(updatedSnCode);
    expect(updatedSn.serialNumberStatus).toBe('IN_USE');

    // 7. Test deleting a single serial number -> equipmentQuantity must decrement automatically
    await serialNumberService.deleteSerialNumber(serialItem2.serialNumberId);
    const equipAfterSnDelete = await equipmentService.getEquipmentById(equipment.equipmentId);
    expect(equipAfterSnDelete.equipmentQuantity).toBe(1);
    expect(equipAfterSnDelete.serialNumbers.length).toBe(1);

    // Clean up movements and serials before converting/deleting
    await prisma.mouvement.deleteMany({ where: { equipmentId: equipment.equipmentId } });
    await prisma.serialNumber.deleteMany({ where: { equipmentId: equipment.equipmentId } });

    // 8. Test modifying non-serialized equipment
    const updatedEquip = await equipmentService.updateEquipment(equipment.equipmentId, {
      hasSerialNumber: false,
      equipmentQuantity: 25,
      minEquipmentQuantity: 5,
    });
    expect(updatedEquip.equipmentQuantity).toBe(25);
    expect(updatedEquip.minequipmentQuantity).toBe(5);

    // 9. Clean up equipment and test shelves
    await equipmentService.deleteEquipment(equipment.equipmentId);
    await prisma.shelf.delete({ where: { shelfId: shelf1.shelfId } });
    await prisma.shelf.delete({ where: { shelfId: shelf2.shelfId } });

    const deletedEquip = await prisma.equipment.findUnique({
      where: { equipmentId: equipment.equipmentId },
    });
    expect(deletedEquip).toBeNull();
  }, 35000);
});
