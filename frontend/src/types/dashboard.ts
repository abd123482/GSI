export interface DashboardStats {
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
    recentMovements: Array<{
      mouvementId: string;
      mouvementStatus: string;
      mouvementQuantity: number;
      equipmentName: string;
      sourceShelfName: string | null;
      destinationShelfName: string | null;
      serialNumberCode: string | null;
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
