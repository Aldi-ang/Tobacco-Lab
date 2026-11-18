import React, { useState, useMemo } from 'react';
import {
  Search,
  Folder,
  FolderOpen,
  Check,
  Minus,
  MapPin,
  Layers,
  UserCheck,
  List,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { RawTobacco } from '../types/tobacco';
import {
  StockGroupingMode,
  StockSortMode,
  buildCategorizedStockGroups,
  isStockReadyForPriceCalc,
} from '../utils/stockScaleEngine';
import { formatRupiah } from '../utils/tobaccoMath';

interface CategorizedStockPickerProps {
  availableTobaccos: RawTobacco[];
  mode: 'MULTI_CHECK' | 'ADD_TO_BLEND';
  selectedIds?: string[];
  onChangeSelectedIds?: (nextIds: string[]) => void;
  onlyCompleteWithPrice?: boolean;
  onChangeOnlyCompleteWithPrice?: (val: boolean) => void;
  alreadyInBlendIds?: string[];
  onAddSingleToBlend?: (tobaccoId: string) => void;
  onAddMultipleToBlend?: (tobaccoIds: string[]) => void;
}

const ITEMS_PER_EXPANDED_FOLDER = 24;

export const CategorizedStockPicker: React.FC<CategorizedStockPickerProps> = ({
  availableTobaccos,
  mode,
  selectedIds = [],
  onChangeSelectedIds,
  onlyCompleteWithPrice = false,
  onChangeOnlyCompleteWithPrice,
  alreadyInBlendIds = [],
  onAddSingleToBlend,
  onAddMultipleToBlend,
}) => {
  const [groupingMode, setGroupingMode] = useState<StockGroupingMode>('ORIGIN_GRADE');
  const [sortMode, setSortMode] = useState<StockSortMode>('FIFO_OLDEST');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [folderVisibleLimits, setFolderVisibleLimits] = useState<Record<string, number>>({});

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const inBlendSet = useMemo(() => new Set(alreadyInBlendIds), [alreadyInBlendIds]);

  const { filteredItems, groups, totalFilteredKg, incompleteFilteredCount } = useMemo(
    () =>
      buildCategorizedStockGroups(availableTobaccos, {
        groupingMode,
        searchQuery,
        onlyCompleteWithPrice,
        sortMode,
      }),
    [availableTobaccos, groupingMode, searchQuery, onlyCompleteWithPrice, sortMode]
  );

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleToggleBatchIds = (batchIds: string[]) => {
    if (!onChangeSelectedIds || batchIds.length === 0) return;
    const allSelected = batchIds.every((id) => selectedSet.has(id));
    if (allSelected) {
      const removeSet = new Set(batchIds);
      onChangeSelectedIds(selectedIds.filter((id) => !removeSet.has(id)));
    } else {
      const merged = new Set(selectedIds);
      for (const id of batchIds) merged.add(id);
      onChangeSelectedIds(Array.from(merged));
    }
  };

  const handleToggleSingleId = (id: string) => {
    if (!onChangeSelectedIds) return;
    if (selectedSet.has(id)) {
      onChangeSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      onChangeSelectedIds([...selectedIds, id]);
    }
  };

  const selectedFilteredCount = useMemo(
    () => filteredItems.filter((t) => selectedSet.has(t.id)).length,
    [filteredItems, selectedSet]
  );

  const selectedFilteredKg = useMemo(
    () =>
      Number(
        filteredItems
          .filter((t) => selectedSet.has(t.id))
          .reduce((s, t) => s + (t.currentStockNetKg || 0), 0)
          .toFixed(1)
      ),
    [filteredItems, selectedSet]
  );

  return (
    <div className="space-y-2.5">
      {/* Top Bar: Grouping Mode Tabs + Quick Completeness & Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/80 p-2 rounded-xl border border-zinc-800/90">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mr-1">
            Kategori:
          </span>
          <button
            type="button"
            onClick={() => setGroupingMode('ORIGIN_GRADE')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors border ${
              groupingMode === 'ORIGIN_GRADE'
                ? 'bg-[#0e1015] text-amber-300 border-amber-500/80'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
            }`}
          >
            <MapPin className="w-3 h-3" />
            <span>Per Daerah</span>
          </button>
          <button
            type="button"
            onClick={() => setGroupingMode('GRADE_ORIGIN')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors border ${
              groupingMode === 'GRADE_ORIGIN'
                ? 'bg-[#0e1015] text-amber-300 border-amber-500/80'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Per Grade</span>
          </button>
          <button
            type="button"
            onClick={() => setGroupingMode('SELLER')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors border ${
              groupingMode === 'SELLER'
                ? 'bg-[#0e1015] text-amber-300 border-amber-500/80'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Per Penjual</span>
          </button>
          <button
            type="button"
            onClick={() => setGroupingMode('FLAT')}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors border ${
              groupingMode === 'FLAT'
                ? 'bg-[#0e1015] text-amber-300 border-amber-500/80'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
            }`}
          >
            <List className="w-3 h-3" />
            <span>Semua Lot</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onChangeOnlyCompleteWithPrice && (
            <label className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold cursor-pointer">
              <input
                type="checkbox"
                checked={onlyCompleteWithPrice}
                onChange={(e) => onChangeOnlyCompleteWithPrice(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>Hanya Stok Ada Harga &amp; Berat</span>
            </label>
          )}

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as StockSortMode)}
            aria-label="Urutan Stok di Kategori"
            className="h-7 px-2 rounded-lg bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-zinc-200 focus:outline-none focus:border-amber-500"
          >
            <option value="FIFO_OLDEST">Urut: FIFO (Stok Lama Dulu)</option>
            <option value="STOCK_DESC">Urut: Sisa KG Terbanyak</option>
            <option value="HPP_ASC">Urut: HPP Termurah</option>
            <option value="WEIGHT_PROFIT_DESC">Urut: Weight Profit Tertinggi</option>
            <option value="NAME_ASC">Urut: Nama A-Z</option>
          </select>
        </div>
      </div>

      {/* Search Bar + Bulk Selection Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari cepat dari ribuan stok (daerah, penjual, grade, lot)..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-black border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {mode === 'MULTI_CHECK' && onChangeSelectedIds && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-zinc-400 font-mono">
              Terpilih: <b className="text-amber-400">{selectedFilteredCount}</b>/{filteredItems.length} lot (
              <b className="text-white">{selectedFilteredKg} kg</b>)
            </span>
            <button
              type="button"
              onClick={() => handleToggleBatchIds(filteredItems.map((t) => t.id))}
              className="px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 font-extrabold cursor-pointer"
            >
              {selectedFilteredCount === filteredItems.length && filteredItems.length > 0
                ? 'Lepas Semua Filter'
                : 'Centang Semua Filter'}
            </button>
            <button
              type="button"
              onClick={() => onChangeSelectedIds([])}
              className="px-2 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold cursor-pointer"
            >
              Reset (0)
            </button>
          </div>
        )}
      </div>

      {incompleteFilteredCount > 0 && !onlyCompleteWithPrice && (
        <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-[10px] text-amber-200">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              Ada <b>{incompleteFilteredCount} lot</b> yang harga/timbangannya menyusul (Rp 0). Centang{' '}
              <b>&ldquo;Hanya Stok Ada Harga &amp; Berat&rdquo;</b> bila ingin meracik dengan HPP akurat.
            </span>
          </span>
        </div>
      )}

      {/* Categorized Folder List */}
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {groups.length === 0 ? (
          <div className="p-4 text-center rounded-xl bg-black/60 border border-zinc-800 text-xs text-zinc-400">
            Tidak ada stok yang cocok dengan pencarian / filter ini.
          </div>
        ) : (
          groups.map((group) => {
            const isExpanded = !!expandedGroupIds[group.id] || groupingMode === 'FLAT';
            const checkedInGroup = group.itemIds.filter((id) => selectedSet.has(id)).length;
            const isAllGroupChecked =
              group.itemIds.length > 0 && checkedInGroup === group.itemIds.length;
            const isPartialGroupChecked =
              checkedInGroup > 0 && checkedInGroup < group.itemIds.length;

            const visibleLimit = folderVisibleLimits[group.id] || ITEMS_PER_EXPANDED_FOLDER;
            const visibleItems = group.items.slice(0, visibleLimit);
            const remainingCount = Math.max(0, group.items.length - visibleLimit);

            return (
              <div
                key={group.id}
                className={`rounded-xl border transition-colors ${
                  isAllGroupChecked && mode === 'MULTI_CHECK'
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : isPartialGroupChecked && mode === 'MULTI_CHECK'
                    ? 'bg-zinc-900/90 border-amber-500/30'
                    : 'bg-black/75 border-zinc-800/90'
                }`}
              >
                {/* Category Header Row */}
                <div className="p-2.5 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {mode === 'MULTI_CHECK' && (
                      <button
                        type="button"
                        onClick={() => handleToggleBatchIds(group.itemIds)}
                        aria-label={`Pilih kategori ${group.title}`}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                          isAllGroupChecked
                            ? 'bg-[#0e1015] border-amber-500 text-amber-300'
                            : isPartialGroupChecked
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-zinc-950 border-zinc-700 text-transparent hover:border-zinc-500'
                        }`}
                      >
                        {isAllGroupChecked ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : isPartialGroupChecked ? (
                          <Minus className="w-3.5 h-3.5 stroke-[3]" />
                        ) : null}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleGroupExpand(group.id)}
                      className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1"
                    >
                      {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-amber-400/80 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-white truncate">
                            {group.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono font-bold text-amber-300">
                            {group.itemCount} lot • {group.totalNetKg} kg
                          </span>
                          {mode === 'MULTI_CHECK' && checkedInGroup > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-[10px] font-mono font-extrabold text-emerald-300">
                              ✓ {checkedInGroup} dipilih
                            </span>
                          )}
                          {group.incompleteCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-[10px] font-bold text-rose-300">
                              ⏳ {group.incompleteCount} menyusul
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] truncate mt-0.5">
                          {group.avgHppPerKg > 0 ? (
                            <span className="text-zinc-400">
                              Rata2 HPP {formatRupiah(group.avgHppPerKg)}/kg ({formatRupiah(group.minHppPerKg)} – {formatRupiah(group.maxHppPerKg)})
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold">
                              Harga beli belum diisi (Menyusul)
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {mode === 'ADD_TO_BLEND' && onAddMultipleToBlend && (
                      <button
                        type="button"
                        onClick={() => {
                          const topThreeIds = group.items
                            .filter((i) => !inBlendSet.has(i.id))
                            .slice(0, 3)
                            .map((i) => i.id);
                          if (topThreeIds.length > 0) {
                            onAddMultipleToBlend(topThreeIds);
                          }
                        }}
                        className="h-7 px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-300 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Pakai FIFO ({Math.min(3, group.items.length)})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleGroupExpand(group.id)}
                      className="h-7 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Tutup' : 'Rincian'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Sub-Bucket Quick Chips (e.g., Grade chips inside Origin folder) */}
                {group.subBuckets.length > 0 && (
                  <div className="px-2.5 pb-2 flex items-center gap-1.5 flex-wrap">
                    {group.subBuckets.map((sub) => {
                      const subCheckedCount = sub.itemIds.filter((id) =>
                        selectedSet.has(id)
                      ).length;
                      const subAllChecked =
                        sub.itemIds.length > 0 && subCheckedCount === sub.itemIds.length;
                      const subPartial =
                        subCheckedCount > 0 && subCheckedCount < sub.itemIds.length;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            if (mode === 'MULTI_CHECK') {
                              handleToggleBatchIds(sub.itemIds);
                            } else if (onAddSingleToBlend && sub.items[0]) {
                              onAddSingleToBlend(sub.items[0].id);
                            }
                          }}
                          className={`px-2 py-1 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            mode === 'MULTI_CHECK'
                              ? subAllChecked
                                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                                : subPartial
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                          }`}
                          title={
                            mode === 'MULTI_CHECK'
                              ? `Klik untuk centang/lepas semua ${sub.label} di ${group.title}`
                              : `Klik untuk tambah stok ${sub.label} teratas ke racikan`
                          }
                        >
                          {mode === 'MULTI_CHECK' && subAllChecked && (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          )}
                          <span className="font-extrabold">{sub.label}</span>
                          <span className="text-zinc-400 font-mono">
                            ({sub.itemCount} • {sub.totalNetKg}kg)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Expanded Individual Lots (Paginated to prevent DOM lag on 2,000+ items) */}
                {isExpanded && (
                  <div className="p-2.5 pt-2 border-t border-zinc-800/80 bg-black/50 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {visibleItems.map((t) => {
                        const isChecked = selectedSet.has(t.id);
                        const isAlreadyInBlend = inBlendSet.has(t.id);
                        const readyPrice = isStockReadyForPriceCalc(t);

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (mode === 'MULTI_CHECK') {
                                handleToggleSingleId(t.id);
                              } else if (!isAlreadyInBlend && onAddSingleToBlend) {
                                onAddSingleToBlend(t.id);
                              }
                            }}
                            disabled={mode === 'ADD_TO_BLEND' && isAlreadyInBlend}
                            className={`text-left p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 transition-colors ${
                              mode === 'MULTI_CHECK'
                                ? isChecked
                                  ? 'bg-amber-500/15 border-amber-500/60 text-white cursor-pointer'
                                  : 'bg-zinc-950/90 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 cursor-pointer'
                                : isAlreadyInBlend
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 opacity-75 cursor-default'
                                : 'bg-zinc-950/90 hover:bg-zinc-900 border-zinc-800 text-zinc-200 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold truncate">{t.name}</span>
                                {!readyPrice && (
                                  <span className="px-1 py-0.2 rounded bg-rose-500/20 border border-rose-500/40 text-[9px] font-bold text-rose-300 shrink-0">
                                    Menyusul
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {t.origin}
                                {t.sellerName ? ` • ${t.sellerName}` : ''} • Sisa{' '}
                                <b className={t.currentStockNetKg <= 0 ? 'text-rose-400' : 'text-zinc-200'}>
                                  {t.currentStockNetKg} kg
                                </b>{' '}
                                •{' '}
                                {t.realCostPerNetKg > 0 ? (
                                  formatRupiah(t.realCostPerNetKg)
                                ) : (
                                  <span className="text-rose-400 font-bold">Rp 0 (Menyusul)</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono font-bold text-amber-300">
                                {t.colorGrade}
                              </span>
                              {mode === 'ADD_TO_BLEND' && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center gap-0.5 border ${
                                    isAlreadyInBlend
                                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                      : 'bg-[#0d0f14] border-amber-500/75 text-amber-300'
                                  }`}
                                >
                                  {isAlreadyInBlend ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Dipakai</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3" />
                                      <span>Pakai</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {remainingCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFolderVisibleLimits((prev) => ({
                            ...prev,
                            [group.id]: visibleLimit + ITEMS_PER_EXPANDED_FOLDER,
                          }))
                        }
                        className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-extrabold text-amber-300 cursor-pointer"
                      >
                        Tampilkan {Math.min(ITEMS_PER_EXPANDED_FOLDER, remainingCount)} Lot Berikutnya (Sisa{' '}
                        {remainingCount} lot di folder ini)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
