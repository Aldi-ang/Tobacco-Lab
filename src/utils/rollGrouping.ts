import { FinishedTobaccoSerial, SerialFactoryStatus, TobaccoRollSample } from '../types/tobacco';

export type RollFolderGroupingMode = 'date' | 'factory';

export interface RollCompactStats {
  totalSerials: number;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalNettoKg: number;
  totalNotaRp: number;
  totalProfitRp: number;
}

export interface RollFolderGroup {
  folderKey: string;
  folderLabel: string;
  sortTimestamp: number;
  rolls: TobaccoRollSample[];
  stats: RollCompactStats;
}

/**
 * Returns true if the serial decision buttons (Diterima / Reject) are locked
 * because a decision has already been made and the user has not unlocked the row.
 */
export function isSerialDecisionLocked(
  status: SerialFactoryStatus | undefined,
  unlockedIds: Record<string, boolean>,
  serialId: string
): boolean {
  const effectiveStatus = status || 'PENDING';
  if (effectiveStatus === 'PENDING') return false;
  return !unlockedIds[serialId];
}

export function getSerialsForRoll(
  roll: TobaccoRollSample,
  finishedBatches: FinishedTobaccoSerial[]
): FinishedTobaccoSerial[] {
  return finishedBatches.filter(
    (b) => b.rollId === roll.id || (!b.rollId && b.rollNumber === roll.rollNumber)
  );
}

export function computeRollCompactStats(
  roll: TobaccoRollSample,
  finishedBatches: FinishedTobaccoSerial[]
): RollCompactStats {
  const serials = getSerialsForRoll(roll, finishedBatches);
  let acceptedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;
  let totalNettoKg = 0;
  let totalNotaRp = 0;
  let totalModalRp = 0;

  for (const s of serials) {
    const st = s.factoryStatus || 'PENDING';
    if (st === 'ACCEPTED_CAIR') acceptedCount++;
    else if (st === 'REJECTED_STOCK') rejectedCount++;
    else pendingCount++;

    if (st !== 'REJECTED_STOCK') {
      const netto = Math.max(0, (s.packaging?.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0));
      totalNettoKg += netto;
      totalNotaRp += Math.round(netto * (s.factoryTargetPricePerKg || 0));
      const modalPerKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg || 0);
      totalModalRp += Math.round(netto * modalPerKg);
    }
  }

  return {
    totalSerials: serials.length,
    acceptedCount,
    rejectedCount,
    pendingCount,
    totalNettoKg: Number(totalNettoKg.toFixed(1)),
    totalNotaRp,
    totalProfitRp: totalNotaRp - totalModalRp,
  };
}

function getLocalDateKey(isoOrTs: string | number | undefined): {
  key: string;
  label: string;
  ts: number;
} {
  const d = isoOrTs ? new Date(isoOrTs) : new Date();
  if (Number.isNaN(d.getTime())) {
    return { key: 'unknown', label: 'Tanggal Lainnya', ts: 0 };
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const key = `${yyyy}-${mm}-${dd}`;
  const label = d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const dayStart = new Date(yyyy, d.getMonth(), d.getDate()).getTime();
  return { key, label, ts: dayStart };
}

/**
 * Groups completed/archived gulungan into folders (by date or by factory)
 * sorted newest-first so 10+ gulungan/day stay organized and scannable.
 */
export function groupRollsIntoFolders(
  rolls: TobaccoRollSample[],
  finishedBatches: FinishedTobaccoSerial[],
  mode: RollFolderGroupingMode = 'date'
): RollFolderGroup[] {
  const map = new Map<
    string,
    {
      folderKey: string;
      folderLabel: string;
      sortTimestamp: number;
      rolls: TobaccoRollSample[];
    }
  >();

  for (const roll of rolls) {
    const rawDate = roll.sentToFactoryDate || roll.sampleCreatedDate;
    const rollTs = rawDate ? new Date(rawDate).getTime() || 0 : 0;

    let folderKey = '';
    let folderLabel = '';
    let sortTimestamp = rollTs;

    if (mode === 'factory') {
      const factory = (roll.targetFactory || 'Pabrik Lainnya').trim() || 'Pabrik Lainnya';
      folderKey = `FAC::${factory.toUpperCase()}`;
      folderLabel = factory;
    } else {
      const d = getLocalDateKey(rawDate);
      folderKey = `DATE::${d.key}`;
      folderLabel = d.label;
      sortTimestamp = d.ts;
    }

    const existing = map.get(folderKey);
    if (!existing) {
      map.set(folderKey, {
        folderKey,
        folderLabel,
        sortTimestamp,
        rolls: [roll],
      });
    } else {
      existing.rolls.push(roll);
      if (sortTimestamp > existing.sortTimestamp) {
        existing.sortTimestamp = sortTimestamp;
      }
    }
  }

  const groups: RollFolderGroup[] = Array.from(map.values()).map((entry) => {
    const sortedRolls = [...entry.rolls].sort((a, b) => {
      const ta = new Date(a.sentToFactoryDate || a.sampleCreatedDate || 0).getTime() || 0;
      const tb = new Date(b.sentToFactoryDate || b.sampleCreatedDate || 0).getTime() || 0;
      return tb - ta;
    });

    const stats: RollCompactStats = {
      totalSerials: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
      totalNettoKg: 0,
      totalNotaRp: 0,
      totalProfitRp: 0,
    };

    for (const r of sortedRolls) {
      const rs = computeRollCompactStats(r, finishedBatches);
      stats.totalSerials += rs.totalSerials;
      stats.acceptedCount += rs.acceptedCount;
      stats.rejectedCount += rs.rejectedCount;
      stats.pendingCount += rs.pendingCount;
      stats.totalNettoKg = Number((stats.totalNettoKg + rs.totalNettoKg).toFixed(1));
      stats.totalNotaRp += rs.totalNotaRp;
      stats.totalProfitRp += rs.totalProfitRp;
    }

    return {
      folderKey: entry.folderKey,
      folderLabel: entry.folderLabel,
      sortTimestamp: entry.sortTimestamp,
      rolls: sortedRolls,
      stats,
    };
  });

  if (mode === 'factory') {
    groups.sort((a, b) => b.sortTimestamp - a.sortTimestamp || a.folderLabel.localeCompare(b.folderLabel));
  } else {
    groups.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
  }

  return groups;
}
