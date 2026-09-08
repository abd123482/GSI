import { describe, it, expect } from 'vitest';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { EquipmentMovementService } from './equipmentMovement.service.js';
import { EquipmentService } from '../equipment/equipment.service.js';
import { SerialNumberService } from '../serial-numbers/serialNumber.service.js';
import 'dotenv/config';

describe('Equipment Movement Entry with Serial Numbers', () => {
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

  it('should create equipment with auto-generated 32-bit serial numbers and null source shelf', async () => {
    const timestamp = Date.now();
    const sn1 = `SN-32BIT-${timestamp}-1`;
    const sn2 = `SN-32BIT-${timestamp}-2`;

    const result = await movementService.createEntryMovementWithEquipment({
      equipmentName: `Equip-Test-${timestamp}`,
      hasSerialNumber: true,
      equipmentQuantity: 2,
      minEquipmentQuantity: 1,
      destinationShelfId: null, // As requested: shelf can be null (unassigned)
      serialNumbers: [sn1, sn2],
    });

    expect(result).toBeDefined();
    expect(result.equipment.equipmentName).toBe(`Equip-Test-${timestamp}`);
    expect(result.equipment.equipmentQuantity).toBe(2);
    expect(result.equipment.hasSerialNumber).toBe(true);

    // Verify movement source shelf is null
    expect(result.movement.sourceShelfId).toBeNull();
    expect(result.movement.destinationShelfId).toBeNull();
    expect(result.movement.mouvementQuantity).toBe(2);
    expect(result.movement.mouvementStatus).toBe('ENTRY');

    // Verify serial numbers were created as children
    expect(result.equipment.serialNumbers.length).toBe(2);
    expect(result.equipment.serialNumbers[0].serialNumberCode).toBe(sn1);
    expect(result.equipment.serialNumbers[1].serialNumberCode).toBe(sn2);

    // Verify getEquipmentById includes child serial numbers
    const foundById = await equipmentService.getEquipmentById(result.equipment.equipmentId);
    expect(foundById).toBeDefined();
    expect(foundById.serialNumbers).toBeDefined();
    expect(foundById.serialNumbers.length).toBe(2);

    // Verify searchEquipments by name includes child serial numbers
    const searchRes = await equipmentService.searchEquipments(
      { equipmentName: result.equipment.equipmentName },
      { page: 1, limit: 10 },
    );
    expect(searchRes.equipments).toBeDefined();
    expect(searchRes.equipments.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.equipments[0].serialNumbers).toBeDefined();
    expect(searchRes.equipments[0].serialNumbers.length).toBe(2);

    // Verify duplicate serial numbers are rejected
    await expect(
      movementService.createEntryMovementWithEquipment({
        equipmentName: `Equip-Dupe-${Date.now()}`,
        hasSerialNumber: true,
        equipmentQuantity: 1,
        destinationShelfId: null,
        serialNumbers: [sn1], // Duplicate!
      }),
    ).rejects.toThrow('Les numéros de série suivants existent déjà');

    // 1. Test modifying a serial number (code and status)
    const snToUpdate = result.equipment.serialNumbers[0];
    const updatedSnCode = `SN-MODIFIED-${timestamp}`;
    const updatedSn = await serialNumberService.updateSerialNumber(
      {
        serialNumberCode: updatedSnCode,
        serialNumberStatus: 'IN_USE',
      },
      snToUpdate.serialNumberId,
    );
    expect(updatedSn.serialNumberCode).toBe(updatedSnCode);
    expect(updatedSn.serialNumberStatus).toBe('IN_USE');

    // 2. Test deleting a single serial number -> equipmentQuantity must decrement automatically
    await serialNumberService.deleteSerialNumber(snToUpdate.serialNumberId);
    const equipAfterSnDelete = await equipmentService.getEquipmentById(result.equipment.equipmentId);
    expect(equipAfterSnDelete.equipmentQuantity).toBe(1);
    expect(equipAfterSnDelete.serialNumbers.length).toBe(1);

    // 3. Test converting equipment to non-serialized (deletes child serial numbers, sets manual quantity)
    const converted = await equipmentService.updateEquipment(result.equipment.equipmentId, {
      hasSerialNumber: false,
      equipmentQuantity: 15,
      equipmentName: `Equip-Converted-${timestamp}`,
    });
    expect(converted.hasSerialNumber).toBe(false);
    expect(converted.equipmentQuantity).toBe(15);
    expect(converted.equipmentName).toBe(`Equip-Converted-${timestamp}`);
    expect(converted.serialNumbers.length).toBe(0);

    // 4. Test modifying non-serialized equipment (name and quantity)
    const updatedNonSerialized = await equipmentService.updateEquipment(result.equipment.equipmentId, {
      equipmentQuantity: 25,
      minEquipmentQuantity: 5,
    });
    expect(updatedNonSerialized.equipmentQuantity).toBe(25);
    expect(updatedNonSerialized.minequipmentQuantity).toBe(5);

    // 5. Test clean deletion of equipment and associated records
    await equipmentService.deleteEquipment(result.equipment.equipmentId);
    const deletedEquip = await prisma.equipment.findUnique({
      where: { equipmentId: result.equipment.equipmentId },
    });
    expect(deletedEquip).toBeNull();
  });
});
