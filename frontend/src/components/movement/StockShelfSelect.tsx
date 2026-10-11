'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Warehouse,
  Layers,
  ChevronRight,
  ChevronDown,
  Check,
  Search,
  X,
  Package,
} from 'lucide-react';

export interface StockShelfItem {
  shelfId: string;
  shelfName: string;
  stockId: string;
  stockName: string;
  availableQuantity?: number;
}

export interface StockShelfSelectProps {
  value: string;
  onChange: (shelfId: string) => void;
  items: StockShelfItem[];
  allStocks?: Array<{ stockId: string; stockName: string | null }>;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function StockShelfSelect({
  value,
  onChange,
  items,
  allStocks,
  placeholder = 'Sélectionnez un emplacement',
  disabled = false,
  emptyMessage = 'Aucun emplacement disponible',
  className = '',
}: StockShelfSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredStockId, setHoveredStockId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const { stocks, shelvesByStock, selectedItem } = useMemo(() => {
    const normalize = (id?: string | null) => (id ? id.toLowerCase().trim() : '');
    const stockMap = new Map<string, { stockId: string; stockName: string }>();
    const shelvesMap = new Map<string, StockShelfItem[]>();
    let foundSelected: StockShelfItem | null = null;

    if (allStocks) {
      for (const s of allStocks) {
        const key = normalize(s.stockId);
        if (key) {
          stockMap.set(key, {
            stockId: key,
            stockName: s.stockName || 'Stock',
          });
          if (!shelvesMap.has(key)) {
            shelvesMap.set(key, []);
          }
        }
      }
    }

    for (const item of items) {
      const key = normalize(item.stockId);
      if (key) {
        if (!stockMap.has(key)) {
          stockMap.set(key, {
            stockId: key,
            stockName: item.stockName || 'Stock',
          });
        }

        const normalizedItem: StockShelfItem = {
          ...item,
          stockId: key,
        };

        const list = shelvesMap.get(key) ?? [];
        list.push(normalizedItem);
        shelvesMap.set(key, list);

        if (normalize(item.shelfId) === normalize(value)) {
          foundSelected = normalizedItem;
        }
      }
    }

    return {
      stocks: Array.from(stockMap.values()).sort((a, b) =>
        a.stockName.localeCompare(b.stockName),
      ),
      shelvesByStock: shelvesMap,
      selectedItem: foundSelected,
    };
  }, [items, value, allStocks]);

  // Handle open / default active stock
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      if (selectedItem) {
        setHoveredStockId(selectedItem.stockId);
      } else if (stocks.length > 0) {
        setHoveredStockId(stocks[0].stockId);
      }
    }
  }, [isOpen, selectedItem, stocks]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter based on search term
  const { filteredStocks, filteredShelvesByStock } = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return {
        filteredStocks: stocks,
        filteredShelvesByStock: shelvesByStock,
      };
    }

    const matchedShelvesMap = new Map<string, StockShelfItem[]>();
    const matchedStockIds = new Set<string>();

    for (const [stockId, shelves] of shelvesByStock.entries()) {
      const stock = stocks.find((s) => s.stockId === stockId);
      const stockMatches = stock?.stockName.toLowerCase().includes(term);

      const matchedShelves = shelves.filter(
        (shelf) =>
          stockMatches ||
          shelf.shelfName.toLowerCase().includes(term) ||
          (shelf.availableQuantity !== undefined &&
            String(shelf.availableQuantity).includes(term)),
      );

      if (matchedShelves.length > 0) {
        matchedShelvesMap.set(stockId, matchedShelves);
        matchedStockIds.add(stockId);
      }
    }

    const matchedStocks = stocks.filter((s) => matchedStockIds.has(s.stockId));

    return {
      filteredStocks: matchedStocks,
      filteredShelvesByStock: matchedShelvesMap,
    };
  }, [searchTerm, stocks, shelvesByStock]);

  // Keep hovered stock valid if filter changes
  useEffect(() => {
    if (filteredStocks.length > 0) {
      if (
        !hoveredStockId ||
        !filteredStocks.some((s) => s.stockId === hoveredStockId)
      ) {
        setHoveredStockId(filteredStocks[0].stockId);
      }
    }
  }, [filteredStocks, hoveredStockId]);

  const activeStock = hoveredStockId
    ? stocks.find((s) => s.stockId === hoveredStockId)
    : null;

  const activeShelves = hoveredStockId
    ? filteredShelvesByStock.get(hoveredStockId) ?? []
    : [];

  function handleSelectShelf(shelfId: string) {
    onChange(shelfId);
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-10 w-full items-center justify-between rounded border border-[#3f3f46] bg-[#1f1b18] px-3 text-left text-xs transition focus:border-[#52525b] focus:outline-none ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:border-[#52525b] cursor-pointer'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
          {selectedItem ? (
            <>
              <Layers className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="truncate font-medium text-[#fafafa]">
                {selectedItem.shelfName}
              </span>
              <span className="shrink-0 rounded border border-[#3f3f46] bg-[#27272a] px-1.5 py-0.5 text-[10px] text-white/60">
                {selectedItem.stockName}
              </span>
              {selectedItem.availableQuantity !== undefined && (
                <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-950/50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                  dispo: {selectedItem.availableQuantity}
                </span>
              )}
            </>
          ) : (
            <span className="truncate text-white/45">{placeholder}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {selectedItem && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClear(e as any);
                }
              }}
              title="Désélectionner"
              className="rounded p-0.5 text-white/40 hover:bg-[#27272a] hover:text-white"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-white' : ''
            }`}
          />
        </div>
      </button>

      {/* Cascading Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[320px] sm:min-w-[460px] md:min-w-[520px] rounded-xl border border-[#3f3f46] bg-[#18181b] p-2.5 shadow-2xl backdrop-blur-md">
          {/* Search bar */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un stock ou emplacement..."
              className="h-8 w-full rounded border border-[#3f3f46] bg-[#27272a] pl-8 pr-2.5 text-xs text-white placeholder:text-white/40 focus:border-[#52525b] focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center p-4 text-center text-xs text-white/45">
              <Package className="mr-2 h-4 w-4 opacity-50" />
              {emptyMessage}
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center p-4 text-center text-xs text-white/45">
              Aucun résultat pour &ldquo;{searchTerm}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Level 1: STOCKS LIST (hoverable) */}
              <div className="flex flex-col">
                <div className="mb-1 flex items-center justify-between px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <span>Stocks ({filteredStocks.length})</span>
                  <span className="text-[9px] lowercase text-white/30 hidden sm:inline">
                    survolez
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {filteredStocks.map((stock) => {
                    const shelfCount =
                      filteredShelvesByStock.get(stock.stockId)?.length ?? 0;
                    const isHovered = hoveredStockId === stock.stockId;
                    const containsSelected =
                      selectedItem?.stockId === stock.stockId;

                    return (
                      <div
                        key={stock.stockId}
                        onMouseEnter={() => setHoveredStockId(stock.stockId)}
                        onClick={() => setHoveredStockId(stock.stockId)}
                        className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition ${
                          isHovered
                            ? 'bg-[#27272a] text-white border border-[#52525b] shadow-sm font-medium'
                            : 'text-white/70 hover:bg-[#27272a]/60 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Warehouse
                            className={`h-3.5 w-3.5 shrink-0 ${
                              isHovered
                                ? 'text-amber-400'
                                : 'text-white/40 group-hover:text-white/70'
                            }`}
                          />
                          <span className="truncate">{stock.stockName}</span>
                          {containsSelected && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
                              isHovered
                                ? 'bg-[#18181b] text-white'
                                : 'bg-[#27272a] text-white/50'
                            }`}
                          >
                            {shelfCount}
                          </span>
                          <ChevronRight
                            className={`h-3.5 w-3.5 ${
                              isHovered ? 'text-white' : 'text-white/30'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Level 2: SHELVES LIST OF HOVERED STOCK */}
              <div className="flex flex-col border-t border-[#3f3f46]/40 pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
                <div className="mb-1 flex items-center justify-between px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <span className="truncate">
                    Emplacements {activeStock ? `• ${activeStock.stockName}` : ''}
                  </span>
                  <span className="font-mono text-[9px] text-white/30">
                    ({activeShelves.length})
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1">
                  {activeShelves.length === 0 ? (
                    <div className="p-4 text-center text-xs text-white/40">
                      Aucun emplacement éligible dans ce stock.
                    </div>
                  ) : (
                    activeShelves.map((shelf) => {
                      const isSelected =
                        shelf.shelfId.toLowerCase().trim() ===
                        (value ?? '').toLowerCase().trim();

                      return (
                        <div
                          key={shelf.shelfId}
                          onClick={() => handleSelectShelf(shelf.shelfId)}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition ${
                            isSelected
                              ? 'border border-emerald-500/40 bg-emerald-950/30 font-medium text-emerald-200'
                              : 'border border-transparent text-white/80 hover:border-[#3f3f46] hover:bg-[#27272a] hover:text-white'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Layers
                              className={`h-3.5 w-3.5 shrink-0 ${
                                isSelected
                                  ? 'text-emerald-400'
                                  : 'text-white/40'
                              }`}
                            />
                            <span className="truncate font-medium">
                              {shelf.shelfName}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {shelf.availableQuantity !== undefined && (
                              <span className="rounded border border-emerald-500/20 bg-emerald-950/50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                                {shelf.availableQuantity} dispo
                              </span>
                            )}
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
