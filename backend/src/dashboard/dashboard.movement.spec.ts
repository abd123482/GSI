import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

describe('dashboard movement documents', () => {
  it('counts mixed/legacy statuses and returns correctly paired child routes and serials', async () => {
    const prisma: any = {
      equipment: { count: vi.fn().mockResolvedValue(0), aggregate: vi.fn().mockResolvedValue({ _sum: { equipmentQuantity: 0 } }) },
      serialNumber: { count: vi.fn().mockResolvedValue(0) },
      shelf: { count: vi.fn().mockResolvedValue(0) },
      stock: { count: vi.fn().mockResolvedValue(0) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      mouvement: {
        count: vi.fn().mockResolvedValue(4),
        groupBy: vi.fn().mockResolvedValue([true, false, false, true].map(mouvementStatus => ({ mouvementStatus, _count: { mouvementId: 1 } }))),
        findMany: vi.fn().mockResolvedValue([{ mouvementId: 'parent', mouvementStatus: true, mouvementQuantity: 3, items: [
          { mouvementEquipmentId: 'a', mouvementStatus: false, mouvementQuantity: 1, equipment: { equipmentName: 'Serialized' }, sourceShelf: { shelfName: 'A' }, destinationShelf: { shelfName: 'B' }, serialNumber: { serialNumberCode: 'SN1' } },
          { mouvementEquipmentId: 'b', mouvementStatus: true, mouvementQuantity: 2, equipment: { equipmentName: 'Bulk' }, sourceShelf: { shelfName: 'C' }, destinationShelf: null, serialNumber: null },
        ] }]),
      },
      inventory: { findMany: vi.fn().mockResolvedValue([]) },
      inventoryWorkUnit: { count: vi.fn().mockResolvedValue(0) },
    };
    const { movementOverview } = await new DashboardService(prisma).getDashboardStats();
    expect(movementOverview).toMatchObject({ totalMovements: 4, inCount: 2, outCount: 2, mixedCount: 0, otherCount: 0 });
    expect(movementOverview.recentMovements[0].items).toEqual([
      expect.objectContaining({ mouvementEquipmentId: 'a', sourceShelfName: 'A', destinationShelfName: 'B', serialNumberCode: 'SN1' }),
      expect.objectContaining({ mouvementEquipmentId: 'b', sourceShelfName: 'C', destinationShelfName: null, mouvementQuantity: 2 }),
    ]);
  });
});
