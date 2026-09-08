import { AxiosInstance, isAxiosError } from 'axios';
import {
  Equipment,
  CreateEntryWithEquipmentInput,
  PaginatedEquipmentsResponse,
  EquipmentPaginationQuery,
} from '@/types/equipment';
import { createEntryMovementWithEquipmentSchema } from '@/schemas/equipment.schema';
import { InsufficientPermissionException } from './shelf.errors';

export const REQUIRED_MOVEMENT_CREATE_PERMISSION = 'movement.create';
export const REQUIRED_EQUIPMENT_READ_PERMISSION = 'equipment.read';
export const REQUIRED_EQUIPMENT_CREATE_PERMISSION = 'equipment.create';

export class EquipmentServiceException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'EquipmentServiceException';
  }
}

export class EquipmentValidationException extends EquipmentServiceException {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message, 400);
    this.name = 'EquipmentValidationException';
  }
}

export class EquipmentService {
  /**
   * Create an equipment and optional serial numbers directly in an ENTRY movement.
   * Proactively checks for 'movement.create' permission.
   * Sets movement source to null, and destination shelf can be null or a specific shelf.
   */
  static async createEntryMovementWithEquipment(
    client: AxiosInstance,
    input: CreateEntryWithEquipmentInput,
    userPermissions?: string[],
  ): Promise<{ equipment: Equipment; movement: any }> {
    // 1. Proactive permission verification
    if (userPermissions && !userPermissions.includes(REQUIRED_MOVEMENT_CREATE_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_MOVEMENT_CREATE_PERMISSION,
        `Permission refusée : Vous n'avez pas le droit '${REQUIRED_MOVEMENT_CREATE_PERMISSION}' pour créer un mouvement d’équipement.`,
      );
    }

    // 2. Client-side Zod validation
    const validation = createEntryMovementWithEquipmentSchema.safeParse(input);
    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path.join('.') || 'form';
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(err.message);
      });
      throw new EquipmentValidationException(
        'Données d’équipement ou de numéros de série invalides',
        fieldErrors,
      );
    }

    // 3. Dispatch POST request to NestJS backend
    try {
      const response = await client.post<{ equipment: Equipment; movement: any }>(
        '/equipment-movements/entry-with-equipment',
        validation.data,
      );
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          const backendMsg =
            error.response.data?.message ||
            `Permission '${REQUIRED_MOVEMENT_CREATE_PERMISSION}' requise.`;
          throw new InsufficientPermissionException(
            REQUIRED_MOVEMENT_CREATE_PERMISSION,
            Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          );
        }

        if (error.response?.status === 401) {
          throw new EquipmentServiceException(
            'Session expirée ou non authentifiée. Veuillez vous reconnecter.',
            401,
          );
        }

        const backendMsg =
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          'Erreur lors de la création de l’équipement en mouvement.';

        throw new EquipmentServiceException(
          Array.isArray(backendMsg) ? backendMsg.join(', ') : backendMsg,
          error.response?.status,
          error.response?.data,
        );
      }

      if (
        error instanceof InsufficientPermissionException ||
        error instanceof EquipmentValidationException
      ) {
        throw error;
      }

      throw new EquipmentServiceException(
        error instanceof Error ? error.message : 'Erreur inconnue lors de la création.',
      );
    }
  }

  /**
   * Fetch all equipments with pagination support and child serial numbers.
   */
  static async getAllEquipments(
    client: AxiosInstance,
    params?: EquipmentPaginationQuery,
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<any>('/equipment', {
        params: {
          page,
          limit,
        },
      });

      if (response.data && Array.isArray(response.data.equipments)) {
        return {
          equipments: response.data.equipments,
          totalEquipments: Number(response.data.totalEquipments ?? response.data.equipments.length),
          totalPages: Number(response.data.totalPages ?? 1),
          currentPage: Number(response.data.currentPage ?? page),
          limit: Number(response.data.limit ?? limit),
        };
      }

      if (Array.isArray(response.data)) {
        return {
          equipments: response.data,
          totalEquipments: response.data.length,
          totalPages: 1,
          currentPage: 1,
          limit: response.data.length,
        };
      }

      return {
        equipments: [],
        totalEquipments: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 403) {
        throw new InsufficientPermissionException(
          REQUIRED_EQUIPMENT_READ_PERMISSION,
          'Permission refusée pour la consultation des équipements.',
        );
      }
      throw new EquipmentServiceException('Échec du chargement des équipements.');
    }
  }

  /**
   * Search equipments by name with pagination.
   */
  static async searchEquipments(
    client: AxiosInstance,
    name: string,
    params?: EquipmentPaginationQuery,
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<any>('/equipment/search', {
        params: {
          equipmentName: name,
          page,
          limit,
        },
      });

      if (response.data && Array.isArray(response.data.equipments)) {
        return {
          equipments: response.data.equipments,
          totalEquipments: Number(response.data.totalEquipments ?? response.data.equipments.length),
          totalPages: Number(response.data.totalPages ?? 1),
          currentPage: Number(response.data.currentPage ?? page),
          limit: Number(response.data.limit ?? limit),
        };
      }

      return {
        equipments: [],
        totalEquipments: 0,
        totalPages: 1,
        currentPage: page,
        limit,
      };
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 403) {
        throw new InsufficientPermissionException(
          REQUIRED_EQUIPMENT_READ_PERMISSION,
          'Permission refusée pour la recherche d’équipements.',
        );
      }
      throw new EquipmentServiceException('Échec de la recherche d’équipements.');
    }
  }

  /**
   * Fetch single equipment by UUID with its child serial numbers and shelf allocations.
   */
  static async getEquipmentById(client: AxiosInstance, id: string): Promise<Equipment> {
    try {
      const response = await client.get<Equipment>(`/equipment/${id}`);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            REQUIRED_EQUIPMENT_READ_PERMISSION,
            'Permission refusée pour consulter cet équipement.',
          );
        }
        if (error.response?.status === 404) {
          throw new EquipmentServiceException(`L’équipement '${id}' est introuvable.`, 404);
        }
      }
      throw new EquipmentServiceException('Échec de la récupération de l’équipement.');
    }
  }

  /**
   * Update equipment scalar fields (name, quantity, hasSerialNumber).
   */
  static async updateEquipment(
    client: AxiosInstance,
    id: string,
    input: {
      equipmentName?: string;
      equipmentQuantity?: number;
      minEquipmentQuantity?: number;
      hasSerialNumber?: boolean;
    },
    userPermissions?: string[],
  ): Promise<Equipment> {
    const perm = 'equipment.update';
    if (userPermissions && !userPermissions.includes(perm)) {
      throw new InsufficientPermissionException(
        perm,
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour modifier cet équipement.`,
      );
    }

    try {
      const response = await client.patch<Equipment>(`/equipment/${id}`, input);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            perm,
            error.response.data?.message || `Permission '${perm}' requise.`,
          );
        }
        const msg = error.response?.data?.message || 'Erreur lors de la mise à jour de l’équipement.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Erreur inconnue lors de la mise à jour de l’équipement.');
    }
  }

  /**
   * Delete equipment and clean up child records.
   */
  static async deleteEquipment(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<void> {
    const perm = 'equipment.delete';
    if (userPermissions && !userPermissions.includes(perm)) {
      throw new InsufficientPermissionException(
        perm,
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour supprimer cet équipement.`,
      );
    }

    try {
      await client.delete(`/equipment/${id}`);
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            perm,
            error.response.data?.message || `Permission '${perm}' requise.`,
          );
        }
        const msg = error.response?.data?.message || 'Erreur lors de la suppression de l’équipement.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Erreur inconnue lors de la suppression de l’équipement.');
    }
  }

  /**
   * Update child serial number (code, status, shelf).
   */
  static async updateSerialNumber(
    client: AxiosInstance,
    id: string,
    input: {
      serialNumberCode?: string;
      serialNumberStatus?: string;
      shelfId?: string | null;
    },
    userPermissions?: string[],
  ): Promise<any> {
    const perm = 'serial-number.update';
    if (userPermissions && !userPermissions.includes(perm)) {
      throw new InsufficientPermissionException(
        perm,
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour modifier ce numéro de série.`,
      );
    }

    try {
      const response = await client.patch(`/serial-number/${id}`, input);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            perm,
            error.response.data?.message || `Permission '${perm}' requise.`,
          );
        }
        const msg = error.response?.data?.message || 'Erreur lors de la mise à jour du numéro de série.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Erreur inconnue lors de la mise à jour du numéro de série.');
    }
  }

  /**
   * Delete child serial number (decrements parent equipment quantity automatically).
   */
  static async deleteSerialNumber(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<void> {
    const perm = 'serial-number.delete';
    if (userPermissions && !userPermissions.includes(perm)) {
      throw new InsufficientPermissionException(
        perm,
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour supprimer ce numéro de série.`,
      );
    }

    try {
      await client.delete(`/serial-number/${id}`);
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            perm,
            error.response.data?.message || `Permission '${perm}' requise.`,
          );
        }
        const msg = error.response?.data?.message || 'Erreur lors de la suppression du numéro de série.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Erreur inconnue lors de la suppression du numéro de série.');
    }
  }
}
