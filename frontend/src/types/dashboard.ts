export interface DashboardStats {
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
      mouvementStatus: boolean;
      mouvementQuantity: number;
      equipmentName: string;
      sourceShelfName: string | null;
      destinationShelfName: string | null;
      serialNumberCode: string | null;
      items?: Array<{
        mouvementEquipmentId: string;
        mouvementStatus: boolean;
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
