'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  useForm,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  Edit3,
  Info,
  Loader2,
  Warehouse,
  X,
} from 'lucide-react';

import type {
  Shelf,
} from '@/types/shelf';
import type {
  Stock,
} from '@/types/stock';
import {
  updateShelfSchema,
  type UpdateShelfFormValues,
} from '@/schemas/shelf.schema';
import {
  useShelves,
} from '@/hooks/use-shelves';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  useApi,
} from '@/hooks/use-api';
import {
  StockService,
} from '@/services/stock.service';
import {
  getErrorMessage,
} from '@/lib/error-message';

type UpdateShelfFormInput = z.input<
  typeof updateShelfSchema
>;

interface UpdateShelfModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpdateShelfModal(
  props: UpdateShelfModalProps,
) {
  if (
    !props.isOpen ||
    !props.shelf
  ) {
    return null;
  }

  return (
    <UpdateShelfContent
      key={`${props.shelf.shelfId}:${props.shelf.shelfName}:${props.shelf.stockId ?? ''}`}
      {...props}
    />
  );
}

function UpdateShelfContent({
  shelf,
  onClose,
  onSuccess,
}: UpdateShelfModalProps) {
  const api = useApi();

  const {
    updateShelf,
    isUpdating,
  } = useShelves({
    enabled: false,
  });

  const {
    canUpdateShelf,
  } = usePermissions();

  const [
    stocks,
    setStocks,
  ] = useState<Stock[]>([]);

  const [
    loadingStocks,
    setLoadingStocks,
  ] = useState(false);

  const [
    serverError,
    setServerError,
  ] =
    useState<string | null>(
      null,
    );

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<
      UpdateShelfFormInput,
      Record<string, never>,
      UpdateShelfFormValues
    >({
      resolver:
        zodResolver(
          updateShelfSchema,
        ),

      defaultValues: {
        shelfName:
          shelf?.shelfName ??
          '',
        stockId:
          shelf?.stockId ??
          null,
      },
    });

  useEffect(() => {
    if (!shelf) return;

    reset({
      shelfName:
        shelf.shelfName ??
        '',
      stockId:
        shelf.stockId ??
        null,
    });
  }, [
    shelf,
    reset,
  ]);

  useEffect(() => {
    let active = true;

    setLoadingStocks(true);

    StockService.getAllStocks(
      api,
      {
        limit: 100,
      },
    )
      .then((result) => {
        if (active) {
          setStocks(
            result.stocks ??
            [],
          );
        }
      })
      .catch(() => {
        if (active) {
          setStocks([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingStocks(
            false,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    api,
  ]);

  if (!shelf) return null;

  const currentShelf = shelf;

  const busy =
    isUpdating ||
    isSubmitting;

  async function submit(
    values: UpdateShelfFormValues,
  ) {
    setServerError(null);

    if (!canUpdateShelf) {
      setServerError(
        "Permission 'shelf.update' requise.",
      );
      return;
    }

    try {
      await updateShelf({
        id: currentShelf.shelfId,
        data: {
          shelfName:
            values.shelfName?.trim(),
          stockId:
            values.stockId ?? null,
        },
      });

      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setServerError(
        getErrorMessage(
          cause,
          'Échec de la modification de l’emplacement.',
        ),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Edit3 className="h-4 w-4" />
            Modifier l’emplacement
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit(
            submit,
          )}
          className="space-y-4 p-5"
        >
          {serverError && (
            <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">
              Nom
            </span>

            <input
              {...register(
                'shelfName',
              )}
              className="h-10 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 text-xs outline-none focus:border-white/50"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Warehouse className="h-3.5 w-3.5" />
              Stock / Entrepôt
            </span>

            <select
              {...register(
                'stockId',
              )}
              disabled={
                busy ||
                loadingStocks
              }
              className="h-10 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
            >
              <option value="">
                Aucun stock
              </option>

              {stocks.map(
                (stock) => (
                  <option
                    key={
                      stock.stockId
                    }
                    value={
                      stock.stockId
                    }
                  >
                    {stock.stockName ??
                      stock.stockId}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="flex gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 p-3 text-[11px] text-sky-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />

            <p>
              La quantité actuelle ({currentShelf.shelfQuantity}) est en lecture seule.
              Elle change uniquement via les mouvements.
            </p>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#3f3a36] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-[#3f3a36] px-4 py-2 text-xs"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={
                busy ||
                !canUpdateShelf
              }
              className="inline-flex items-center gap-1.5 rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
            >
              {busy && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Enregistrer
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
