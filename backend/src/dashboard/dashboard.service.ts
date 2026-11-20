import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DashboardStatsResponse {
  stockOverview: {
    totalArticles: number;
    totalUnits: number;
    totalSerials: number;
    serialsWithShelf: number;
    unassignedSerials: number;
    lowStockCount: number;
    outOfStockCount: number;
    healthyStockCount: number;
    totalShelves: number;
    occupiedShelves: number;
    emptyShelves: number;
    totalStocks: number;
    lowStockItems: Array<{
      equipmentId: string;
      equipmentName: string;
      equipmentQuantity: number;
      minequipmentQuantity: number;
    }>;
    outOfStockItems: Array<{
      equipmentId: string;
      equipmentName: string;
      minequipmentQuantity: number;
    }>;
    stockDistribution: Array<{
      stockId: string;
      stockName: string;
      totalUnits: number;
      shelvesCount: number;
      percentage: number;
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
      mouvementStatus: string | boolean;
      mouvementQuantity: number;
      equipmentName: string;
      sourceShelfName: string | null;
      destinationShelfName: string | null;
      serialNumberCode: string | null;
      items?: Array<{
        mouvementEquipmentId: string;
        mouvementStatus: string | boolean;
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
    totalWorkUnits: number;
    convergedWorkUnits: number;
    divergentWorkUnits: number;
    pendingWorkUnits: number;
    accuracyRate: number;
    totalIssues: number;
    openIssuesCount: number;
    resolvedIssuesCount: number;
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
  anomaliesOverview: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    inventoryIssuesCount: number;
    stockAlertsCount: number;
    orphanSerialsCount: number;
    items: Array<{
      id: string;
      category: 'DISAGREEMENT' | 'STOCK_VARIANCE' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'ORPHAN_SERIAL';
      title: string;
      description: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      status: 'OPEN' | 'RESOLVED';
      createdAt: string;
      source: string;
      equipmentName?: string;
      shelfName?: string;
      inventoryTitle?: string;
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
      stockHealthSummaryRaw,
      lowStockItemsRaw,
      outOfStockItemsRaw,
      shelfOccupancyRaw,
      stockDistributionRaw,
      orphanSerialsRaw,
      totalMovements,
      movementsByType,
      recentMouvementsRaw,
      inventories,
      pendingAdjudicationsCount,
      unitReconciliationStatsRaw,
      inventoryIssuesRaw,
      openIssuesCount,
      totalIssuesCount,
    ] = await Promise.all([
      // 1. Total Articles count
      this.prisma.equipment.count(),

      // 2. Physical Total Units
      this.prisma.equipment.aggregate({
        _sum: { minequipmentQuantity: true },
      }).then(() => this.prisma.$queryRaw`
        SELECT SUM(
          CASE 
            WHEN destinationShelfId IS NOT NULL THEN equipmentQuantity 
            WHEN sourceShelfId IS NOT NULL THEN -equipmentQuantity 
            ELSE 0 
          END
        ) as total
        FROM dbo.MovementEquipment
      `).then((res: any) => ({ _sum: { equipmentQuantity: Number(res[0]?.total ?? 0) } })).catch(() => ({ _sum: { equipmentQuantity: 0 } })),

      // 3. Total Serials
      this.prisma.serialNumber.count(),

      // 4. Serials currently placed on a shelf
      this.prisma.$queryRaw`
        WITH CurrentSerials AS (
          SELECT serialNumberId FROM (
            SELECT serialNumberId, CONVERT(bigint, equipmentQuantity) AS delta
            FROM dbo.MovementEquipment
            WHERE destinationShelfId IS NOT NULL AND serialNumberId IS NOT NULL
            UNION ALL
            SELECT serialNumberId, -CONVERT(bigint, equipmentQuantity) AS delta
            FROM dbo.MovementEquipment
            WHERE sourceShelfId IS NOT NULL AND serialNumberId IS NOT NULL
          ) AS entries
          GROUP BY serialNumberId HAVING SUM(delta) > 0
        )
        SELECT COUNT(*) as count FROM CurrentSerials
      `.then((res: any) => Number(res[0]?.count ?? 0)).catch(() => 0),

      // 5. Total Shelves & Stocks
      this.prisma.shelf.count(),
      this.prisma.stock.count(),

      // 6. Stock Health Summary (out of stock, low stock, healthy stock)
      this.prisma.$queryRaw<Array<{
        outOfStockCount: bigint | number;
        lowStockCount: bigint | number;
        healthyStockCount: bigint | number;
      }>>`
        WITH EquipmentStock AS (
          SELECT e.equipmentId, e.minequipmentQuantity,
            COALESCE(SUM(CASE WHEN m.destinationShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END), 0) AS equipmentQuantity
          FROM dbo.Equipment e
          LEFT JOIN dbo.MovementEquipment m ON e.equipmentId = m.equipmentId
          GROUP BY e.equipmentId, e.minequipmentQuantity
        )
        SELECT 
          COUNT(CASE WHEN equipmentQuantity <= 0 THEN 1 END) as outOfStockCount,
          COUNT(CASE WHEN equipmentQuantity > 0 AND equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0 THEN 1 END) as lowStockCount,
          COUNT(CASE WHEN equipmentQuantity > minequipmentQuantity OR (minequipmentQuantity = 0 AND equipmentQuantity > 0) THEN 1 END) as healthyStockCount
        FROM EquipmentStock
      `.catch(() => [{ outOfStockCount: 0, lowStockCount: 0, healthyStockCount: 0 }]),

      // 7. Critical Low Stock Items
      this.prisma.$queryRaw<Array<{
        equipmentId: string;
        equipmentName: string;
        equipmentQuantity: number;
        minequipmentQuantity: number;
      }>>`
        WITH EquipmentStock AS (
          SELECT e.equipmentId, e.equipmentName, e.minequipmentQuantity,
            COALESCE(SUM(CASE WHEN m.destinationShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END), 0) AS equipmentQuantity
          FROM dbo.Equipment e
          LEFT JOIN dbo.MovementEquipment m ON e.equipmentId = m.equipmentId
          GROUP BY e.equipmentId, e.equipmentName, e.minequipmentQuantity
        )
        SELECT TOP 6 equipmentId, equipmentName, COALESCE(equipmentQuantity, 0) as equipmentQuantity, minequipmentQuantity 
        FROM EquipmentStock 
        WHERE equipmentQuantity > 0 AND equipmentQuantity <= minequipmentQuantity AND minequipmentQuantity > 0
        ORDER BY equipmentQuantity ASC
      `.catch(() => []),

      // 8. Out of Stock Items (0 units)
      this.prisma.$queryRaw<Array<{
        equipmentId: string;
        equipmentName: string;
        minequipmentQuantity: number;
      }>>`
        WITH EquipmentStock AS (
          SELECT e.equipmentId, e.equipmentName, e.minequipmentQuantity,
            COALESCE(SUM(CASE WHEN m.destinationShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId IS NOT NULL THEN m.equipmentQuantity ELSE 0 END), 0) AS equipmentQuantity
          FROM dbo.Equipment e
          LEFT JOIN dbo.MovementEquipment m ON e.equipmentId = m.equipmentId
          GROUP BY e.equipmentId, e.equipmentName, e.minequipmentQuantity
        )
        SELECT TOP 6 equipmentId, equipmentName, minequipmentQuantity
        FROM EquipmentStock 
        WHERE equipmentQuantity <= 0
        ORDER BY equipmentName ASC
      `.catch(() => []),

      // 9. Shelf Occupancy (occupied vs empty)
      this.prisma.$queryRaw<Array<{
        occupiedCount: bigint | number;
        emptyCount: bigint | number;
      }>>`
        WITH ShelfOccupancy AS (
          SELECT sh.shelfId,
            COALESCE(SUM(CASE WHEN m.destinationShelfId = sh.shelfId THEN m.equipmentQuantity ELSE 0 END) -
            SUM(CASE WHEN m.sourceShelfId = sh.shelfId THEN m.equipmentQuantity ELSE 0 END), 0) as currentQty
          FROM dbo.Shelf sh
          LEFT JOIN dbo.MovementEquipment m ON (m.destinationShelfId = sh.shelfId OR m.sourceShelfId = sh.shelfId)
          GROUP BY sh.shelfId
        )
        SELECT 
          COUNT(CASE WHEN currentQty > 0 THEN 1 END) as occupiedCount,
          COUNT(CASE WHEN currentQty <= 0 THEN 1 END) as emptyCount
        FROM ShelfOccupancy
      `.catch(() => [{ occupiedCount: 0, emptyCount: 0 }]),

      // 10. Stock Distribution by Warehouse
      this.prisma.$queryRaw<Array<{
        stockId: string;
        stockName: string;
        shelvesCount: bigint | number;
        totalUnits: bigint | number;
      }>>`
        SELECT s.stockId, COALESCE(s.stockName, 'Stock Principal') as stockName,
               COUNT(DISTINCT sh.shelfId) as shelvesCount,
               COALESCE(SUM(
                  CASE WHEN m.destinationShelfId = sh.shelfId THEN m.equipmentQuantity ELSE 0 END
               ) - SUM(
                  CASE WHEN m.sourceShelfId = sh.shelfId THEN m.equipmentQuantity ELSE 0 END
               ), 0) as totalUnits
        FROM dbo.Stock s
        LEFT JOIN dbo.Shelf sh ON s.stockId = sh.stockId
        LEFT JOIN dbo.MovementEquipment m ON (m.destinationShelfId = sh.shelfId OR m.sourceShelfId = sh.shelfId)
        GROUP BY s.stockId, s.stockName
      `.catch(() => []),

      // 11. Top Orphan Serials (not currently on any shelf)
      this.prisma.$queryRaw<Array<{
        serialNumberId: string;
        serialNumberCode: string;
        equipmentName: string;
      }>>`
        WITH CurrentSerials AS (
          SELECT serialNumberId FROM (
            SELECT serialNumberId, CONVERT(bigint, equipmentQuantity) AS delta
            FROM dbo.MovementEquipment
            WHERE destinationShelfId IS NOT NULL AND serialNumberId IS NOT NULL
            UNION ALL
            SELECT serialNumberId, -CONVERT(bigint, equipmentQuantity) AS delta
            FROM dbo.MovementEquipment
            WHERE sourceShelfId IS NOT NULL AND serialNumberId IS NOT NULL
          ) AS entries
          GROUP BY serialNumberId HAVING SUM(delta) > 0
        )
        SELECT TOP 6 s.serialNumberId, s.serialNumberCode, e.equipmentName
        FROM dbo.SerialNumber s
        INNER JOIN dbo.Equipment e ON s.equipmentId = e.equipmentId
        WHERE s.serialNumberId NOT IN (SELECT serialNumberId FROM CurrentSerials)
        ORDER BY s.serialNumberCode ASC
      `.catch(() => []),

      // 12. Movements count and grouped by type
      this.prisma.mouvement.count(),
      this.prisma.mouvement.groupBy({
        by: ['mouvementStatus'],
        _count: { mouvementId: true },
      }),

      // 13. Recent movements with items
      this.prisma.mouvement.findMany({
        take: 8,
        orderBy: [{ createdAt: 'desc' }, { mouvementId: 'asc' }],
        include: {
          items: { include: { equipment: true, sourceShelf: true, destinationShelf: true, serialNumber: true } },
        },
      }),

      // 14. Inventories & Campaigns
      this.prisma.inventory.findMany({
        take: 6,
        select: {
          inventoryId: true,
          title: true,
          typeInventory: true,
          status: true,
          createdAt: true,
          units: {
            select: { status: true, reconciliationStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 15. Pending Adjudications
      (this.prisma.inventoryUnit?.count
        ? this.prisma.inventoryUnit.count({
            where: { status: 'COUNTED' },
          })
        : Promise.resolve(0)
      ),

      // 16. Inventory Units reconciliation breakdown (CONVERGED vs RECOUNT_REQUIRED vs PENDING)
      (this.prisma.inventoryUnit?.groupBy
        ? (this.prisma.inventoryUnit.groupBy as any)({
            by: ['reconciliationStatus'],
            _count: { unitId: true },
          })
        : Promise.resolve([])
      ) as Promise<Array<{ reconciliationStatus: string; _count: { unitId: number } }>>,

      // 17. Inventory Issues & Discrepancies
      (this.prisma.inventoryIssue?.findMany
        ? this.prisma.inventoryIssue.findMany({
            take: 12,
            orderBy: { createdAt: 'desc' },
            include: {
              inventory: { select: { title: true, roundNumber: true } },
              unit: {
                include: {
                  equipment: { select: { equipmentName: true } },
                  shelf: { select: { shelfName: true } },
                },
              },
            },
          })
        : Promise.resolve([])
      ) as Promise<any[]>,

      // 18. Open and Total Issues count
      (this.prisma.inventoryIssue?.count
        ? this.prisma.inventoryIssue.count({ where: { status: 'OPEN' } })
        : Promise.resolve(0)
      ),
      (this.prisma.inventoryIssue?.count
        ? this.prisma.inventoryIssue.count()
        : Promise.resolve(0)
      ),
    ]);

    // Parse stock health numbers
    const healthSummary = stockHealthSummaryRaw[0] ?? { outOfStockCount: 0, lowStockCount: 0, healthyStockCount: 0 };
    const outOfStockCount = Number(healthSummary.outOfStockCount ?? 0);
    const lowStockCount = Number(healthSummary.lowStockCount ?? 0);
    const healthyStockCount = Number(healthSummary.healthyStockCount ?? 0);

    const lowStockItems = lowStockItemsRaw.map((item: any) => ({
      equipmentId: String(item.equipmentId),
      equipmentName: item.equipmentName,
      equipmentQuantity: Number(item.equipmentQuantity),
      minequipmentQuantity: Number(item.minequipmentQuantity),
    }));

    const outOfStockItems = outOfStockItemsRaw.map((item: any) => ({
      equipmentId: String(item.equipmentId),
      equipmentName: item.equipmentName,
      minequipmentQuantity: Number(item.minequipmentQuantity),
    }));

    // Shelf occupancy
    const occupancy = shelfOccupancyRaw[0] ?? { occupiedCount: 0, emptyCount: 0 };
    const occupiedShelves = Number(occupancy.occupiedCount ?? 0);
    const emptyShelves = Number(occupancy.emptyCount ?? 0);

    // Stock distribution with percentages
    const totalPhysicalUnits = unitsAgg._sum?.equipmentQuantity || 0;
    const stockDistribution = stockDistributionRaw.map((s: any) => {
      const units = Number(s.totalUnits);
      const percentage = totalPhysicalUnits > 0 ? Math.round((units / totalPhysicalUnits) * 100) : 0;
      return {
        stockId: String(s.stockId),
        stockName: s.stockName,
        totalUnits: units,
        shelvesCount: Number(s.shelvesCount),
        percentage,
      };
    });

    const unassignedSerials = Math.max(0, totalSerials - serialsWithShelf);

    // Movement Calculations
    let inCount = 0;
    let outCount = 0;
    let transferCount = 0;
    let mixedCount = 0;
    let otherCount = 0;
    for (const group of movementsByType) {
      const isOut = group.mouvementStatus;
      const count = group._count?.mouvementId || 0;
      if (isOut) outCount += count;
      else inCount += count;
    }

    const recentMovements = recentMouvementsRaw.map((m: any) => ({
      mouvementId: m.mouvementId,
      mouvementStatus: m.mouvementStatus || 'TRANSFER',
      mouvementQuantity: m.mouvementQuantity ?? 1,
      equipmentName: (m.items?.length ? [...new Set(m.items.map((item: any) => item.equipment?.equipmentName))].join(', ') : m.equipment?.equipmentName) || 'Article non spécifié',
      sourceShelfName: (m.items?.length ? [...new Set(m.items.map((item: any) => item.sourceShelf?.shelfName).filter(Boolean))].join(', ') : m.sourceShelf?.shelfName) || null,
      destinationShelfName: (m.items?.length ? [...new Set(m.items.map((item: any) => item.destinationShelf?.shelfName).filter(Boolean))].join(', ') : m.destinationShelf?.shelfName) || null,
      serialNumberCode: m.items?.length === 1 ? m.items[0].serialNumber?.serialNumberCode ?? null : m.serialNumber?.serialNumberCode ?? null,
      items: m.items?.map((item: any) => ({
        mouvementEquipmentId: item.movementEquipmentId ?? item.mouvementEquipmentId,
        mouvementStatus: item.mouvementStatus,
        mouvementQuantity: item.mouvementQuantity,
        equipmentName: item.equipment?.equipmentName,
        sourceShelfName: item.sourceShelf?.shelfName ?? null,
        destinationShelfName: item.destinationShelf?.shelfName ?? null,
        serialNumberCode: item.serialNumber?.serialNumberCode ?? null,
      })) ?? [],
    }));

    // Inventory Calculations
    let convergedWorkUnits = 0;
    let divergentWorkUnits = 0;
    let pendingWorkUnits = 0;

    for (const group of unitReconciliationStatsRaw) {
      const status = (group.reconciliationStatus || '').toUpperCase();
      const count = group._count?.unitId ?? 0;
      if (['CONVERGED', 'ACCEPTED', 'VALIDATED'].includes(status)) {
        convergedWorkUnits += count;
      } else if (['RECOUNT_REQUIRED', 'DIVERGENT', 'DISAGREEMENT'].includes(status)) {
        divergentWorkUnits += count;
      } else {
        pendingWorkUnits += count;
      }
    }

    const totalWorkUnits = convergedWorkUnits + divergentWorkUnits + pendingWorkUnits;
    const accuracyRate =
      convergedWorkUnits + divergentWorkUnits > 0
        ? Math.round((convergedWorkUnits / (convergedWorkUnits + divergentWorkUnits)) * 100)
        : 100;

    const activeInventoriesList = inventories.map((inv: any) => {
      const unitsList = inv.units ?? [];
      const invTotalUnits = unitsList.length;
      const invCompletedUnits = unitsList.filter((u: any) =>
        ['COUNTED', 'ADJUDICATED', 'FINALIZED', 'CONVERGED'].includes((u.status || '').toUpperCase()),
      ).length;
      const progressPercent = invTotalUnits > 0 ? Math.round((invCompletedUnits / invTotalUnits) * 100) : 0;
      return {
        inventoryId: inv.inventoryId,
        title: inv.title || `Inventaire ${inv.typeInventory || ''}`,
        typeInventory: inv.typeInventory || 'Général',
        status: inv.status,
        createdAt: inv.createdAt ? inv.createdAt.toISOString() : null,
        totalWorkUnits: invTotalUnits,
        completedWorkUnits: invCompletedUnits,
        progressPercent,
      };
    });

    const activeInventoriesCount = inventories.filter((inv: any) =>
      ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COUNTING', 'ADJUDICATION'].includes((inv.status || '').toUpperCase()),
    ).length;

    const completedInventoriesCount = inventories.filter((inv: any) =>
      ['COMPLETED', 'FINALIZED'].includes((inv.status || '').toUpperCase()),
    ).length;

    // Compile Centralized Anomalies Feed
    const anomalyItems: DashboardStatsResponse['anomaliesOverview']['items'] = [];

    // 1. Inventory Issues (Disagreements & Stock Variances)
    for (const issue of inventoryIssuesRaw) {
      const isDisagreement = issue.issueCategory === 'DISAGREEMENT' || issue.type === 'CONTROLLER_DISAGREEMENT';
      const eqName = issue.unit?.equipment?.equipmentName;
      const shName = issue.unit?.shelf?.shelfName;
      const invTitle = issue.inventory?.title || 'Campagne d\'inventaire';

      anomalyItems.push({
        id: issue.issueId,
        category: isDisagreement ? 'DISAGREEMENT' : 'STOCK_VARIANCE',
        title: isDisagreement ? `Désaccord contrôleurs C1 ≠ C2 (${invTitle})` : `Écart inventaire physique vs théorique (${issue.type || 'Écart'})`,
        description: [
          invTitle,
          shName ? `Emplacement : ${shName}` : null,
          eqName ? `Article : ${eqName}` : null,
        ].filter(Boolean).join(' • '),
        severity: isDisagreement ? 'CRITICAL' : 'WARNING',
        status: issue.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
        createdAt: issue.createdAt ? new Date(issue.createdAt).toISOString() : new Date().toISOString(),
        source: 'INVENTORY_AUDIT',
        equipmentName: eqName,
        shelfName: shName,
        inventoryTitle: invTitle,
      });
    }

    // 2. Out of Stock Items (Ruptures)
    for (const item of outOfStockItems) {
      anomalyItems.push({
        id: `out-of-stock-${item.equipmentId}`,
        category: 'OUT_OF_STOCK',
        title: `Rupture de stock : ${item.equipmentName}`,
        description: `Quantité disponible nulle (0 unité en stock). Seuil de réapprovisionnement configuré à ${item.minequipmentQuantity} u.`,
        severity: 'CRITICAL',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        source: 'STOCK_LEVEL',
        equipmentName: item.equipmentName,
      });
    }

    // 3. Low Stock Items (Sous seuil critique)
    for (const item of lowStockItems) {
      const deficit = item.minequipmentQuantity - item.equipmentQuantity;
      anomalyItems.push({
        id: `low-stock-${item.equipmentId}`,
        category: 'LOW_STOCK',
        title: `Seuil minimum dépassé : ${item.equipmentName}`,
        description: `Quantité actuelle : ${item.equipmentQuantity} u. / Seuil d'alerte : ${item.minequipmentQuantity} u. (Déficit : ${deficit} u.)`,
        severity: 'WARNING',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        source: 'STOCK_LEVEL',
        equipmentName: item.equipmentName,
      });
    }

    // 4. Orphan Serials (Non assignés à un rayon)
    for (const s of orphanSerialsRaw) {
      anomalyItems.push({
        id: `orphan-serial-${s.serialNumberId}`,
        category: 'ORPHAN_SERIAL',
        title: `N° de série non localisé : ${s.serialNumberCode}`,
        description: `Article : ${s.equipmentName} • Numéro de série actif mais absent de tout rayon de stockage.`,
        severity: 'WARNING',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        source: 'TRACEABILITY',
        equipmentName: s.equipmentName,
      });
    }

    const criticalCount = anomalyItems.filter((a) => a.severity === 'CRITICAL' && a.status === 'OPEN').length;
    const warningCount = anomalyItems.filter((a) => a.severity === 'WARNING' && a.status === 'OPEN').length;
    const totalAnomalies = openIssuesCount + outOfStockCount + lowStockCount + unassignedSerials;

    return {
      stockOverview: {
        totalArticles,
        totalUnits: totalPhysicalUnits,
        totalSerials,
        serialsWithShelf,
        unassignedSerials,
        lowStockCount,
        outOfStockCount,
        healthyStockCount,
        totalShelves,
        occupiedShelves,
        emptyShelves,
        totalStocks,
        lowStockItems,
        outOfStockItems,
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
        totalWorkUnits,
        convergedWorkUnits,
        divergentWorkUnits,
        pendingWorkUnits,
        accuracyRate,
        totalIssues: totalIssuesCount,
        openIssuesCount,
        resolvedIssuesCount: Math.max(0, totalIssuesCount - openIssuesCount),
        activeCampaigns: activeInventoriesList,
      },
      anomaliesOverview: {
        totalAnomalies,
        criticalCount,
        warningCount,
        inventoryIssuesCount: openIssuesCount,
        stockAlertsCount: outOfStockCount + lowStockCount,
        orphanSerialsCount: unassignedSerials,
        items: anomalyItems,
      },
    };
  }
}
