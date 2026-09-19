import { AxiosInstance, isAxiosError } from 'axios';
import {
  Equipment,
  EquipmentWithShelvesResponse,
  CreateEquipmentDirectInput,
  PaginatedEquipmentsResponse,
  EquipmentPaginationQuery,
  SerialNumber,
} from '@/types/equipment';
import {
  createDirectEquipmentSchema,
} from '@/schemas/equipment.schema';
import { InsufficientPermissionException } from './shelf.errors';

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
   * Fetch all equipments with pagination support and child serial numbers.
   */
  static async getAllEquipments(
    client: AxiosInstance,
    params?: EquipmentPaginationQuery,
  ): Promise<PaginatedEquipmentsResponse> {
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 10;
      const response = await client.get<Partial<PaginatedEquipmentsResponse> | Equipment[]>('/equipment', {
        params: {
          page,
          limit,
        },
      });

      if (response.data && !Array.isArray(response.data) && Array.isArray(response.data.equipments)) {
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
          'Permission refusée pour la consultation des articles.',
        );
      }
      throw new EquipmentServiceException('Échec du chargement des articles.');
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
      const response = await client.get<Partial<PaginatedEquipmentsResponse> | Equipment[]>('/equipment/search', {
        params: {
          equipmentName: name,
          page,
          limit,
        },
      });

      if (response.data && !Array.isArray(response.data) && Array.isArray(response.data.equipments)) {
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
          'Permission refusée pour la recherche d’articles.',
        );
      }
      throw new EquipmentServiceException('Échec de la recherche d’articles.');
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
            'Permission refusée pour consulter cet article.',
          );
        }
        if (error.response?.status === 404) {
          throw new EquipmentServiceException(`L’article '${id}' est introuvable.`, 404);
        }
      }
      throw new EquipmentServiceException('Échec de la récupération de l’article.');
    }
  }

  /**
   * Retrieve all shelves where an equipment is stored (GET /equipment/:id/shelves)
   * Returns the equipment with all its EquipmentShelfs tuples and allocation metrics.
   */
  static async getEquipmentShelves(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<EquipmentWithShelvesResponse> {
    if (userPermissions && !userPermissions.includes(REQUIRED_EQUIPMENT_READ_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_EQUIPMENT_READ_PERMISSION,
        `Permission '${REQUIRED_EQUIPMENT_READ_PERMISSION}' requise pour consulter les emplacements de cet article.`,
      );
    }

    try {
      const response = await client.get<EquipmentWithShelvesResponse>(`/equipment/${id}/shelves`);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            REQUIRED_EQUIPMENT_READ_PERMISSION,
            'Permission refusée pour consulter les emplacements de cet article.',
          );
        }
        if (error.response?.status === 404) {
          throw new EquipmentServiceException(`L’article '${id}' est introuvable.`, 404);
        }
        const msg = error.response?.data?.message || 'Échec de la récupération des emplacements.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Échec de la récupération des emplacements.');
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
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour modifier cet article.`,
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
        const msg = error.response?.data?.message || 'Erreur lors de la mise à jour de l’article.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Erreur inconnue lors de la mise à jour de l’article.');
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
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour supprimer cet article.`,
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
        const msg = error.response?.data?.message || 'Erreur lors de la suppression de l’article.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw new EquipmentServiceException('Erreur inconnue lors de la suppression de l’article.');
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
    },
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    const perm = 'serial-number.update';
    if (userPermissions && !userPermissions.includes(perm)) {
      throw new InsufficientPermissionException(
        perm,
        `Permission refusée : Vous n'avez pas le droit '${perm}' pour modifier ce numéro de série.`,
      );
    }

    try {
      const response = await client.patch<SerialNumber>(`/serial-number/${id}`, input);
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

  /**
   * Create an equipment directly via EquipmentController (POST /equipment)
   * and optionally creates serial numbers via SerialNumberController (POST /serial-number/batch).
   */
  static async createEquipmentDirect(
    client: AxiosInstance,
    input: CreateEquipmentDirectInput,
    userPermissions?: string[],
  ): Promise<Equipment> {
    if (userPermissions && !userPermissions.includes(REQUIRED_EQUIPMENT_CREATE_PERMISSION)) {
      throw new InsufficientPermissionException(
        REQUIRED_EQUIPMENT_CREATE_PERMISSION,
        `Permission refusée : Vous n'avez pas le droit '${REQUIRED_EQUIPMENT_CREATE_PERMISSION}' pour créer un article.`,
      );
    }

    if (input.hasSerialNumber && userPermissions && !userPermissions.includes('serial-number.create')) {
      throw new InsufficientPermissionException(
        'serial-number.create',
        `Permission refusée : Vous n'avez pas le droit 'serial-number.create' pour enregistrer des numéros de série.`,
      );
    }

    // 1. Zod validate
    const validation = createDirectEquipmentSchema.safeParse(input);
    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      const errorDetails: string[] = [];
      validation.error.errors.forEach((err) => {
        const field = err.path.join('.') || 'form';
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(err.message);
        errorDetails.push(`${err.message}`);
      });
      throw new EquipmentValidationException(
        errorDetails.length > 0 ? `Données invalides : ${errorDetails.join(', ')}` : 'Données d’article invalides',
        fieldErrors,
      );
    }

    try {
      const selectedShelfId = input.shelfId && input.shelfId.trim() !== '' ? input.shelfId.trim() : undefined;

      // 2. Create equipment tuple (initial IN movement created automatically if shelfId provided)
      const eqPayload = {
        equipmentName: input.equipmentName.trim(),
        hasSerialNumber: input.hasSerialNumber,
        equipmentQuantity: input.hasSerialNumber ? 0 : Number(input.equipmentQuantity),
        minEquipmentQuantity: Number(input.minEquipmentQuantity ?? 0),
        shelfId: selectedShelfId,
      };

      const eqResponse = await client.post<Equipment>('/equipment', eqPayload);
      const createdEquipment = eqResponse.data;

      // 3. If serialized and serial codes provided, create in bulk via SerialNumberController
      // (If shelfId is provided, serial numbers are assigned to the shelf and initial IN movements created)
      if (input.hasSerialNumber && input.serialNumbers && input.serialNumbers.length > 0) {
        await client.post('/serial-number/batch', {
          equipmentId: createdEquipment.equipmentId,
          serialNumberCodes: input.serialNumbers,
          serialNumberStatus: 'AVAILABLE',
          shelfId: selectedShelfId,
        });
      }

      // 4. Fetch freshly created equipment with relations
      const finalRes = await client.get<Equipment>(`/equipment/${createdEquipment.equipmentId}`);
      return finalRes.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new InsufficientPermissionException(
            REQUIRED_EQUIPMENT_CREATE_PERMISSION,
            error.response.data?.message || `Permission refusée.`,
          );
        }
        const msg = error.response?.data?.message || 'Erreur lors de la création de l’article.';
        throw new EquipmentServiceException(
          Array.isArray(msg) ? msg.join(', ') : msg,
          error.response?.status,
        );
      }
      throw error;
    }
  }

}
