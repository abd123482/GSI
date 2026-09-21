import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DashboardStatsResponse {
  stockOverview: {
    totalArticles: number;
    totalUnits: number;
    totalSerials: number;
    serialsWithShelf: number;
    lowStockCount: number;
    totalShelves: number;
    totalStocks: number;
    lowStockItems: Array<{
      equipmentId: string;
      equipmentName: string;
      equipmentQuantity: number;
      minequipmentQuantity: number;
    }>;
    stockDistribution: Array<{
      stockId: string;
      stockName: string;
      totalUnits: number;
      shelvesCount: number;
    }>;
  };
  movementOverview: {
    totalMovements: number;
    inCount: number;
    outCount: number;
    transferCount: number;
    mixedCount?: number;
    otherCount?: number;
    recentMovements: Array<{
      mouvementId: string;
      mouvementStatus: string;
      mouvementQuantity: number;
      equipmentName: string;
      sourceShelfName: string | null;
      destinationShelfName: string | null;
      serialNumberCode: string | null;
      items?: Array<{
        mouvementEquipmentId: string;
        mouvementStatus: string;
        mouvementQuantity: number;
        equipmentName: string;
        sourceShelfName: string | null;
        destinationShelfName: string | null;
        serialNumberCode: string | null;
      }>;
    }>;
  };
  inventoryOverview: {
    totalInventories: number;
    activeInventoriesCount: number;
    completedInventoriesCount: number;
    pendingAdjudications: number;
    activeCampaigns: Array<{
      inventoryId: string;
      title: string;
      typeInventory: string;
      status: string;
      createdAt: string | null;
      totalWorkUnits: number;
      completedWorkUnits: number;
      progressPercent: number;
    }>;
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const [
      totalArticles,
      unitsAgg,
      totalSerials,
      serialsWithShelf,
      totalShelves,
      totalStocks,
      lowStockCountRaw,
      lowStockItemsRaw,
      stockDistributionRaw,
      totalMovements,
      movementsByType,
      recentMouvementsRaw,
      inventories,
      pendingAdjudicationsCount,
    ] = await Promise.all([
      this.prisma.equipment.count(),
      this.prisma.equipment.aggregate({
        _sum: { equipmentQuantity: true },
      }),
      this.prisma.serialNumber.count(),
      this.prisma.serialNumber.count({
        where: { shelfId: { not: null } },
      }),
      this.prisma.shelf.count(),
      this.prisma.stock.count(),
      this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) as [count] 
        FROM dbo.Equipment 
        WHERE equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0
      `,
      this.prisma.$queryRaw<Array<{
        equipmentId: string;
        equipmentName: string;
        equipmentQuantity: number;
        minequipmentQuantity: number;
      }>>`
        SELECT TOP 5 equipmentId, equipmentName, equipmentQuantity, minequipmentQuantity 
        FROM dbo.Equipment 
        WHERE equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0
        ORDER BY equipmentQuantity ASC
      `,
      this.prisma.$queryRaw<Array<{
        stockId: string;
        stockName: string;
        shelvesCount: bigint | number;
        totalUnits: bigint | number;
      }>>`
        SELECT s.stockId, COALESCE(s.stockName, 'Stock Principal') as stockName,
               COUNT(sh.shelfId) as shelvesCount,
               COALESCE(SUM(sh.shelfQuantity), 0) as totalUnits
        FROM dbo.Stock s
        LEFT JOIN dbo.Shelf sh ON s.stockId = sh.stockId
        GROUP BY s.stockId, s.stockName
      `,
      this.prisma.mouvement.count(),
      this.prisma.mouvement.groupBy({
        by: ['mouvementStatus'],
        _count: { mouvementId: true },
      }),
      this.prisma.mouvement.findMany({
        take: 8,
        orderBy: [{ createdAt: 'desc' }, { mouvementId: 'asc' }],
        include: {
          items: { include: { equipment: true, sourceShelf: true, destinationShelf: true, serialNumber: true } },
          equipment: { select: { equipmentName: true } },
          sourceShelf: { select: { shelfName: true } },
          destinationShelf: { select: { shelfName: true } },
          serialNumber: { select: { serialNumberCode: true } },
        },
      }),
      this.prisma.inventory.findMany({
        take: 5,
        select: {
          inventoryId: true,
          title: true,
          typeInventory: true,
          status: true,
          createdAt: true,
          workUnits: {
            select: { status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryWorkUnit.count({
        where: { status: 'COUNTED' },
      }),
    ]);

    const lowStockCount = Number(lowStockCountRaw[0]?.count ?? 0);
    const lowStockItems = lowStockItemsRaw.map((item) => ({
      equipmentId: String(item.equipmentId),
      equipmentName: item.equipmentName,
      equipmentQuantity: Number(item.equipmentQuantity),
      minequipmentQuantity: Number(item.minequipmentQuantity),
    }));

    const stockDistribution = stockDistributionRaw.map((s) => ({
      stockId: String(s.stockId),
      stockName: s.stockName,
      totalUnits: Number(s.totalUnits),
      shelvesCount: Number(s.shelvesCount),
    }));

    // Compute Movement Stats
    let inCount = 0;
    let outCount = 0;
    let transferCount = 0;
    let mixedCount = 0;
    let otherCount = 0;
    for (const group of movementsByType) {
      const status = group.mouvementStatus?.toUpperCase() || '';
      const count = group._count.mouvementId || 0;
      if (status === 'IN' || status === 'ENTRY') inCount += count;
      else if (status === 'OUT' || status === 'EXIT') outCount += count;
      else if (status === 'TRANSFER') transferCount += count;
      else if (status === 'MIXED') mixedCount += count;
      else otherCount += count;
    }

    const recentMovements = recentMouvementsRaw.map((m) => ({
      mouvementId: m.mouvementId,
      mouvementStatus: m.mouvementStatus || 'TRANSFER',
      mouvementQuantity: m.mouvementQuantity ?? 1,
      equipmentName: (m.items.length ? [...new Set(m.items.map(item => item.equipment.equipmentName))].join(', ') : m.equipment?.equipmentName) || 'Article non spécifié',
      sourceShelfName: (m.items.length ? [...new Set(m.items.map(item => item.sourceShelf?.shelfName).filter(Boolean))].join(', ') : m.sourceShelf?.shelfName) || null,
      destinationShelfName: (m.items.length ? [...new Set(m.items.map(item => item.destinationShelf?.shelfName).filter(Boolean))].join(', ') : m.destinationShelf?.shelfName) || null,
      serialNumberCode: m.items.length === 1 ? m.items[0].serialNumber?.serialNumberCode ?? null : m.serialNumber?.serialNumberCode ?? null,
      items: m.items.map(item => ({
        mouvementEquipmentId: item.mouvementEquipmentId,
        mouvementStatus: item.mouvementStatus,
        mouvementQuantity: item.mouvementQuantity,
        equipmentName: item.equipment.equipmentName,
        sourceShelfName: item.sourceShelf?.shelfName ?? null,
        destinationShelfName: item.destinationShelf?.shelfName ?? null,
        serialNumberCode: item.serialNumber?.serialNumberCode ?? null,
      })),
    }));

    // Compute Inventory Stats
    const activeInventoriesList = inventories.map((inv) => {
      const totalWorkUnits = inv.workUnits.length;
      const completedWorkUnits = inv.workUnits.filter((u) =>
        ['COUNTED', 'ADJUDICATED', 'FINALIZED'].includes(u.status.toUpperCase()),
      ).length;
      const progressPercent = totalWorkUnits > 0 ? Math.round((completedWorkUnits / totalWorkUnits) * 100) : 0;
      return {
        inventoryId: inv.inventoryId,
        title: inv.title || `Inventaire ${inv.typeInventory || ''}`,
        typeInventory: inv.typeInventory || 'Général',
        status: inv.status,
        createdAt: inv.createdAt ? inv.createdAt.toISOString() : null,
        totalWorkUnits,
        completedWorkUnits,
        progressPercent,
      };
    });

    const activeInventoriesCount = inventories.filter((inv) =>
      ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'ADJUDICATION'].includes(inv.status.toUpperCase()),
    ).length;

    const completedInventoriesCount = inventories.filter((inv) =>
      ['COMPLETED', 'FINALIZED'].includes(inv.status.toUpperCase()),
    ).length;

    return {
      stockOverview: {
        totalArticles,
        totalUnits: unitsAgg._sum.equipmentQuantity || 0,
        totalSerials,
        serialsWithShelf,
        lowStockCount,
        totalShelves,
        totalStocks,
        lowStockItems,
        stockDistribution,
      },
      movementOverview: {
        totalMovements,
        inCount,
        outCount,
        transferCount,
        mixedCount,
        otherCount,
        recentMovements,
      },
      inventoryOverview: {
        totalInventories: inventories.length,
        activeInventoriesCount,
        completedInventoriesCount,
        pendingAdjudications: pendingAdjudicationsCount,
        activeCampaigns: activeInventoriesList,
      },
    };
  }
}
