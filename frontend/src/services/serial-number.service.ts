import type {
  AxiosInstance,
} from 'axios';
import {
  isAxiosError,
} from 'axios';

import type {
  SerialNumber,
} from '@/types/equipment';

import {
  InsufficientPermissionException,
} from '@/services/shelf.errors';

export const REQUIRED_SERIAL_READ_PERMISSION =
  'serial-number.read';
export const REQUIRED_SERIAL_CREATE_PERMISSION =
  'serial-number.create';
export const REQUIRED_SERIAL_UPDATE_PERMISSION =
  'serial-number.update';
export const REQUIRED_SERIAL_DELETE_PERMISSION =
  'serial-number.delete';

export interface SerialNumberQuery {
  page?: number;
  limit?: number;
  serialNumberCode?: string;
  serialNumberStatus?: string;
  equipmentId?: string;
  shelfId?: string;
}

export interface PaginatedSerialNumbersResponse {
  serialNumbers: SerialNumber[];
  totalSerialNumbers: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

export interface CreateSerialNumberInput {
  serialNumberCode: string;
  equipmentId: string;
  serialNumberStatus?: string;
}

export interface CreateBatchSerialNumbersInput {
  equipmentId: string;
  serialNumberCodes: string[];
  serialNumberStatus?: string;
}

export interface CreateBatchSerialNumbersResponse {
  success: boolean;
  count: number;
  equipmentId: string;
}

export interface UpdateSerialNumberInput {
  serialNumberStatus: string;
}

function ensurePermission(
  permissions:
    | string[]
    | undefined,
  permission: string,
) {
  if (
    permissions &&
    !permissions.includes(
      permission,
    )
  ) {
    throw new InsufficientPermissionException(
      permission,
      `Permission '${permission}' requise.`,
    );
  }
}

function throwSerialError(
  error: unknown,
  fallback: string,
): never {
  if (isAxiosError(error)) {
    const message =
      error.response?.data
        ?.message;

    if (
      Array.isArray(
        message,
      )
    ) {
      throw new Error(
        message.join(', '),
      );
    }

    throw new Error(
      typeof message ===
        'string' &&
        message
        ? message
        : error.message ||
          fallback,
    );
  }

  if (
    error instanceof Error
  ) {
    throw error;
  }

  throw new Error(fallback);
}

export class SerialNumberService {
  static async getSerialNumbers(
    client: AxiosInstance,
    query: SerialNumberQuery = {},
    userPermissions?: string[],
  ): Promise<PaginatedSerialNumbersResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<PaginatedSerialNumbersResponse>(
          '/serial-numbers',
          {
            params: {
              page:
                query.page ?? 1,
              limit:
                query.limit ?? 20,
              serialNumberCode:
                query.serialNumberCode,
              serialNumberStatus:
                query.serialNumberStatus,
              equipmentId:
                query.equipmentId,
              shelfId:
                query.shelfId,
            },
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Impossible de charger les numéros de série.',
      );
    }
  }

  static async getSerialNumberById(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_READ_PERMISSION,
    );

    try {
      const response =
        await client.get<SerialNumber>(
          `/serial-numbers/${id}`,
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Numéro de série introuvable.',
      );
    }
  }

  static async createSerialNumber(
    client: AxiosInstance,
    input: CreateSerialNumberInput,
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_CREATE_PERMISSION,
    );

    const code =
      input.serialNumberCode
        .trim();

    if (!code) {
      throw new Error(
        'Le code du numéro de série est requis.',
      );
    }

    try {
      const response =
        await client.post<SerialNumber>(
          '/serial-numbers',
          {
            serialNumberCode:
              code,
            equipmentId:
              input.equipmentId,
            serialNumberStatus:
              input.serialNumberStatus ??
              'AVAILABLE',
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Impossible de créer le numéro de série.',
      );
    }
  }

  static async createBatchSerialNumbers(
    client: AxiosInstance,
    input: CreateBatchSerialNumbersInput,
    userPermissions?: string[],
  ): Promise<CreateBatchSerialNumbersResponse> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_CREATE_PERMISSION,
    );

    const codes =
      input.serialNumberCodes
        .map(
          (code) =>
            code.trim(),
        )
        .filter(Boolean);

    if (!codes.length) {
      throw new Error(
        'Ajoutez au moins un code de série.',
      );
    }

    if (
      new Set(
        codes.map((code) =>
          code.toUpperCase(),
        ),
      ).size !==
      codes.length
    ) {
      throw new Error(
        'Les codes de série doivent être uniques.',
      );
    }

    try {
      const response =
        await client.post<CreateBatchSerialNumbersResponse>(
          '/serial-numbers/batch',
          {
            equipmentId:
              input.equipmentId,
            serialNumberCodes:
              codes,
            serialNumberStatus:
              input.serialNumberStatus ??
              'AVAILABLE',
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Impossible de créer les numéros de série.',
      );
    }
  }

  /**
   * Serial code is immutable after creation.
   * Only serialNumberStatus is sent.
   */
  static async updateSerialNumber(
    client: AxiosInstance,
    id: string,
    input: UpdateSerialNumberInput,
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_UPDATE_PERMISSION,
    );

    try {
      const response =
        await client.patch<SerialNumber>(
          `/serial-numbers/${id}`,
          {
            serialNumberStatus:
              input.serialNumberStatus.trim(),
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Impossible de modifier le statut du numéro de série.',
      );
    }
  }

  static async updateSerialNumberStatus(
    client: AxiosInstance,
    id: string,
    serialNumberStatus: string,
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_UPDATE_PERMISSION,
    );

    try {
      const response =
        await client.patch<SerialNumber>(
          `/serial-numbers/${id}/status`,
          {
            serialNumberStatus:
              serialNumberStatus.trim(),
          },
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Impossible de modifier le statut du numéro de série.',
      );
    }
  }

  static async deleteSerialNumber(
    client: AxiosInstance,
    id: string,
    userPermissions?: string[],
  ): Promise<SerialNumber> {
    ensurePermission(
      userPermissions,
      REQUIRED_SERIAL_DELETE_PERMISSION,
    );

    try {
      const response =
        await client.delete<SerialNumber>(
          `/serial-numbers/${id}`,
        );

      return response.data;
    } catch (error: unknown) {
      throwSerialError(
        error,
        'Le numéro de série ne peut pas être supprimé.',
      );
    }
  }
}
