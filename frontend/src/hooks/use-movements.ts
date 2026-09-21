'use client';

import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/error-message';
import type { Movement } from '@/types/movement';

export type MovementTypeV3 = 'IN' | 'OUT' | 'TRANSFER';

export interface CreateMovementItemInput {
    equipmentId: string;
    serialNumberId?: string | null;
    movementQuantity: number;
}

export interface CreateMovementInput {
    movementType: MovementTypeV3;
    sourceShelfId?: string | null;
    destinationShelfId?: string | null;
    items: CreateMovementItemInput[];
}

export interface MovementQuery {
    page?: number;
    limit?: number;
    movementType?: MovementTypeV3;
    equipmentId?: string;
    serialNumberId?: string;
    sourceShelfId?: string;
    destinationShelfId?: string;
}

export interface PaginatedMovementsResponse {
    movements: Movement[];
    totalMovements: number;
    totalPages: number;
    currentPage: number;
    limit: number;
}

function cleanMovementQuery(query: MovementQuery) {
    return Object.fromEntries(
        Object.entries(query).filter(([, value]) => {
            if (value === undefined || value === null || value === '') return false;
            return true;
        }),
    );
}

function validateCreateMovement(input: CreateMovementInput) {
    if (!input.items.length) {
        throw new Error('Ajoutez au moins un article au mouvement.');
    }

    if (input.items.length > 100) {
        throw new Error('Un mouvement ne peut pas contenir plus de 100 lignes.');
    }

    const source = input.sourceShelfId ?? null;
    const destination = input.destinationShelfId ?? null;

    if (input.movementType === 'IN' && (source !== null || destination === null)) {
        throw new Error(
            'Une entrée nécessite uniquement un emplacement de destination.',
        );
    }

    if (input.movementType === 'OUT' && (source === null || destination !== null)) {
        throw new Error(
            'Une sortie nécessite uniquement un emplacement source.',
        );
    }

    if (
        input.movementType === 'TRANSFER' &&
        (
            source === null ||
            destination === null ||
            source.toLowerCase() === destination.toLowerCase()
        )
    ) {
        throw new Error(
            'Un transfert nécessite deux emplacements différents.',
        );
    }

    for (const item of input.items) {
        if (!item.equipmentId) {
            throw new Error('Chaque ligne doit contenir un article.');
        }

        if (
            !Number.isInteger(item.movementQuantity) ||
            item.movementQuantity <= 0
        ) {
            throw new Error(
                'La quantité de chaque ligne doit être un entier strictement positif.',
            );
        }

        if (item.serialNumberId && item.movementQuantity !== 1) {
            throw new Error(
                'Une ligne avec numéro de série doit avoir une quantité égale à 1.',
            );
        }
    }
}

/**
 * Canonical V3 movement history hook.
 *
 * Backend:
 * GET /movements
 *
 * Supported filters:
 * movementType, equipmentId, serialNumberId,
 * sourceShelfId, destinationShelfId.
 */
export function useMovements(
    query: MovementQuery = {},
    enabled = true,
) {
    const api = useApi();

    const normalizedQuery: MovementQuery = {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        movementType: query.movementType,
        equipmentId: query.equipmentId,
        serialNumberId: query.serialNumberId,
        sourceShelfId: query.sourceShelfId,
        destinationShelfId: query.destinationShelfId,
    };

    return useQuery<PaginatedMovementsResponse>({
        queryKey: ['movements', normalizedQuery],
        queryFn: async () => {
            const response = await api.get<PaginatedMovementsResponse>(
                '/movements',
                {
                    params: cleanMovementQuery(normalizedQuery),
                },
            );

            return response.data;
        },
        enabled,
        placeholderData: keepPreviousData,
        staleTime: 20_000,
    });
}

/**
 * Fetch one complete movement document.
 *
 * Backend:
 * GET /movements/:id
 */
export function useMovement(
    movementId?: string | null,
    enabled = true,
) {
    const api = useApi();

    return useQuery<Movement>({
        queryKey: ['movements', 'detail', movementId],
        queryFn: async () => {
            if (!movementId) {
                throw new Error('Identifiant du mouvement requis.');
            }

            const response = await api.get<Movement>(
                `/movements/${movementId}`,
            );

            return response.data;
        },
        enabled: enabled && Boolean(movementId),
        staleTime: 30_000,
    });
}

/**
 * Create one V3 movement document.
 *
 * IMPORTANT:
 * - movementType is shared by ALL lines.
 * - source/destination are shared by ALL lines.
 * - items contain only equipment/serial/quantity.
 *
 * Backend:
 * POST /movements
 */
export function useCreateMovement() {
    const api = useApi();
    const queryClient = useQueryClient();
    const { isAdmin, hasPermission } = usePermissions();

    return useMutation({
        mutationFn: async (input: CreateMovementInput) => {
            if (!isAdmin && !hasPermission('movement.create')) {
                throw new Error(
                    "Permission 'movement.create' requise pour enregistrer un mouvement.",
                );
            }

            validateCreateMovement(input);

            const response = await api.post<Movement>(
                '/movements',
                {
                    movementType: input.movementType,
                    sourceShelfId: input.sourceShelfId ?? null,
                    destinationShelfId: input.destinationShelfId ?? null,
                    items: input.items.map((item) => ({
                        equipmentId: item.equipmentId,
                        serialNumberId: item.serialNumberId ?? null,
                        movementQuantity: item.movementQuantity,
                    })),
                },
            );

            return response.data;
        },

        onSuccess: async (movement) => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ['movements'],
                }),
                queryClient.invalidateQueries({
                    queryKey: ['equipments'],
                }),
                queryClient.invalidateQueries({
                    queryKey: ['shelves'],
                }),
                queryClient.invalidateQueries({
                    queryKey: ['serial-numbers'],
                }),
                queryClient.invalidateQueries({
                    queryKey: ['dashboard'],
                }),
            ]);

            toast.success('Mouvement enregistré', {
                description: `${movement.mouvementStatus ?? 'Mouvement'} · ${movement.items?.length ?? 0
                    } ligne(s) · ${movement.mouvementQuantity ?? 0} unité(s)`,
            });
        },

        onError: (error: unknown) => {
            toast.error('Impossible d’enregistrer le mouvement', {
                description: getErrorMessage(
                    error,
                    'Une erreur est survenue pendant la création du mouvement.',
                ),
            });
        },
    });
}
