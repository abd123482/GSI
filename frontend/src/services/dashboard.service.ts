import { AxiosInstance, isAxiosError } from 'axios';
import { DashboardStats } from '@/types/dashboard';

export const REQUIRED_DASHBOARD_READ_PERMISSION = 'dashboard.read';

export class DashboardServiceException extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'DashboardServiceException';
  }
}

export class DashboardService {
  static async getStats(client: AxiosInstance): Promise<DashboardStats> {
    try {
      const response = await client.get<DashboardStats>('/dashboard/stats');
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || error.message || 'Échec de la récupération des statistiques du tableau de bord.';
        throw new DashboardServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new DashboardServiceException('Erreur inattendue lors de la récupération des statistiques.');
    }
  }
}
