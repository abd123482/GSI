import type { AxiosInstance } from 'axios';
import { isAxiosError } from 'axios';

import type { SerialNumber } from '@/types/equipment';
import { InsufficientPermissionException } from '@/services/shelf.errors';

export const REQUIRED_SERIAL_READ_PERMISSION = 'serial-number.read';
export const REQUIRED_SERIAL_CREATE_PERMISSION = 'serial-number.create';
export const REQUIRED_SERIAL_UPDATE_PERMISSION = 'serial-number.update';
export const REQUIRED_SERIAL_DELETE_PERMISSION = 'serial-number.delete';

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
    serialNumberCode?: string;
    serialNumberStatus?: string;
}

export class SerialNumberServiceException extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = 'SerialNumberServiceException';
    }
}

function ensurePermission(
    userPermissions: string[] | undefined,
    permission: string,
) {
    if (userPermissions && !userPermissions.includes(permission)) {
        throw new InsufficientPermissionException(
            permission,
            `Permission '${permission}' requise.`,
        );
    }
}

function cleanQuery(query: SerialNumberQuery) {
    return Object.fromEntries(
        Object.entries(query).filter(([, value]) => {
            if (value === undefined || value === null || value === '') return false;
            return true;
        }),
    );
}

function throwSerialNumberError(
    error: unknown,
    fallback: string,
    permission?: string,
): never {
    if (isAxiosError(error)) {
        const status = error.response?.status;
        const rawMessage = error.response?.data?.message;
        const message = Array.isArray(rawMessage)
            ? rawMessage.join(', ')
            : rawMessage || error.message || fallback;

        if (status === 403 && permission) {
            throw new InsufficientPermissionException(
                permission,
                message,
            );
        }

        throw new SerialNumberServiceException(
            message,
            status,
            error.response?.data,
        );
    }

    if (
        error instanceof InsufficientPermissionException ||
        error instanceof SerialNumberServiceException
    ) {
        throw error;
    }

    throw new SerialNumberServiceException(
        error instanceof Error ? error.message : fallback,
    );
}

export class SerialNumberService {
    /**
     * Canonical list/search route.
     *
     * GET /serial-numbers
     */
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
                        params: cleanQuery({
                            page: query.page ?? 1,
                            limit: query.limit ?? 20,
                            serialNumberCode: query.serialNumberCode,
                            serialNumberStatus: query.serialNumberStatus,
                            equipmentId: query.equipmentId,
                            shelfId: query.shelfId,
                        }),
                    },
                );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Impossible de charger les numéros de série.',
                REQUIRED_SERIAL_READ_PERMISSION,
            );
        }
    }

    /**
     * GET /serial-numbers/:id
     */
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
            const response = await client.get<SerialNumber>(
                `/serial-numbers/${id}`,
            );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Numéro de série introuvable.',
                REQUIRED_SERIAL_READ_PERMISSION,
            );
        }
    }

    /**
     * GET /serial-numbers/code/:code
     */
    static async getSerialNumberByCode(
        client: AxiosInstance,
        code: string,
        userPermissions?: string[],
    ): Promise<SerialNumber> {
        ensurePermission(
            userPermissions,
            REQUIRED_SERIAL_READ_PERMISSION,
        );

        try {
            const response = await client.get<SerialNumber>(
                `/serial-numbers/code/${encodeURIComponent(code.trim())}`,
            );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Numéro de série introuvable.',
                REQUIRED_SERIAL_READ_PERMISSION,
            );
        }
    }

    /**
     * Creates a serial identity only.
     *
     * The backend always creates it with shelfId = null.
     * Physical placement happens later through POST /movements.
     *
     * POST /serial-numbers
     */
    static async createSerialNumber(
        client: AxiosInstance,
        input: CreateSerialNumberInput,
        userPermissions?: string[],
    ): Promise<SerialNumber> {
        ensurePermission(
            userPermissions,
            REQUIRED_SERIAL_CREATE_PERMISSION,
        );

        if (!input.serialNumberCode.trim()) {
            throw new SerialNumberServiceException(
                'Le code du numéro de série est requis.',
                400,
            );
        }

        if (!input.equipmentId) {
            throw new SerialNumberServiceException(
                'L’article est requis.',
                400,
            );
        }

        try {
            const response = await client.post<SerialNumber>(
                '/serial-numbers',
                {
                    serialNumberCode: input.serialNumberCode.trim(),
                    equipmentId: input.equipmentId,
                    serialNumberStatus:
                        input.serialNumberStatus?.trim() || 'AVAILABLE',
                },
            );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Impossible de créer le numéro de série.',
                REQUIRED_SERIAL_CREATE_PERMISSION,
            );
        }
    }

    /**
     * POST /serial-numbers/batch
     *
     * No shelfId is sent.
     */
    static async createBatchSerialNumbers(
        client: AxiosInstance,
        input: CreateBatchSerialNumbersInput,
        userPermissions?: string[],
    ): Promise<CreateBatchSerialNumbersResponse> {
        ensurePermission(
            userPermissions,
            REQUIRED_SERIAL_CREATE_PERMISSION,
        );

        const serialNumberCodes = input.serialNumberCodes
            .map((code) => code.trim())
            .filter(Boolean);

        if (!serialNumberCodes.length) {
            throw new SerialNumberServiceException(
                'Ajoutez au moins un numéro de série.',
                400,
            );
        }

        if (serialNumberCodes.length > 1000) {
            throw new SerialNumberServiceException(
                'Un lot ne peut pas dépasser 1000 numéros de série.',
                400,
            );
        }

        if (
            new Set(serialNumberCodes).size !==
            serialNumberCodes.length
        ) {
            throw new SerialNumberServiceException(
                'La liste contient des numéros de série en double.',
                400,
            );
        }

        try {
            const response =
                await client.post<CreateBatchSerialNumbersResponse>(
                    '/serial-numbers/batch',
                    {
                        equipmentId: input.equipmentId,
                        serialNumberCodes,
                        serialNumberStatus:
                            input.serialNumberStatus?.trim() || 'AVAILABLE',
                    },
                );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Impossible de créer les numéros de série.',
                REQUIRED_SERIAL_CREATE_PERMISSION,
            );
        }
    }

    /**
     * PATCH /serial-numbers/:id
     *
     * Editable fields only:
     * - serialNumberCode
     * - serialNumberStatus
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

        const payload: UpdateSerialNumberInput = {};

        if (input.serialNumberCode !== undefined) {
            payload.serialNumberCode =
                input.serialNumberCode.trim();
        }

        if (input.serialNumberStatus !== undefined) {
            payload.serialNumberStatus =
                input.serialNumberStatus.trim();
        }

        if (
            payload.serialNumberCode === undefined &&
            payload.serialNumberStatus === undefined
        ) {
            throw new SerialNumberServiceException(
                'Aucune modification à enregistrer.',
                400,
            );
        }

        try {
            const response = await client.patch<SerialNumber>(
                `/serial-numbers/${id}`,
                payload,
            );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Impossible de modifier le numéro de série.',
                REQUIRED_SERIAL_UPDATE_PERMISSION,
            );
        }
    }

    /**
     * PATCH /serial-numbers/:id/status
     */
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
            const response = await client.patch<SerialNumber>(
                `/serial-numbers/${id}/status`,
                {
                    serialNumberStatus: serialNumberStatus.trim(),
                },
            );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Impossible de modifier le statut du numéro de série.',
                REQUIRED_SERIAL_UPDATE_PERMISSION,
            );
        }
    }

    /**
     * DELETE /serial-numbers/:id
     *
     * Backend rules:
     * - refused while the serial is on a shelf
     * - refused when movement history exists
     */
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
            const response = await client.delete<SerialNumber>(
                `/serial-numbers/${id}`,
            );

            return response.data;
        } catch (error: unknown) {
            throwSerialNumberError(
                error,
                'Impossible de supprimer le numéro de série.',
                REQUIRED_SERIAL_DELETE_PERMISSION,
            );
        }
    }
}
