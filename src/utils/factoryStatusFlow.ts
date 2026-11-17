import { FinishedTobaccoSerial, TobaccoRollSample } from '../types/tobacco';

export interface RollStatusSummary {
  totalSerials: number;
  pendingCount: number;
  acceptedCount: number;
  cairCount: number;
  belumCairCount: number;
  rejectedCount: number;
  resolvedCount: number;
  isFullyResolved: boolean;
}

export interface PartitionedShippedRolls {
  activePendingRolls: TobaccoRollSample[];
  completedShippedRolls: TobaccoRollSample[];
}

export function getSerialsForRoll(
  roll: TobaccoRollSample,
  finishedBatches: FinishedTobaccoSerial[]
): FinishedTobaccoSerial[] {
  return finishedBatches.filter(
    (b) => b.rollId === roll.id || (roll.rollNumber && b.rollNumber === roll.rollNumber)
  );
}

export function getRollStatusSummary(
  roll: TobaccoRollSample,
  finishedBatches: FinishedTobaccoSerial[]
): RollStatusSummary {
  const serials = getSerialsForRoll(roll, finishedBatches);
  let pendingCount = 0;
  let acceptedCount = 0;
  let cairCount = 0;
  let belumCairCount = 0;
  let rejectedCount = 0;

  for (const s of serials) {
    const status = s.factoryStatus || 'PENDING';
    if (status === 'ACCEPTED_CAIR') {
      acceptedCount++;
      if ((s.paymentStatus || 'BELUM_CAIR') === 'CAIR') {
        cairCount++;
      } else {
        belumCairCount++;
      }
    } else if (status === 'REJECTED_STOCK') {
      rejectedCount++;
    } else {
      pendingCount++;
    }
  }

  const totalSerials = serials.length;
  const resolvedCount = acceptedCount + rejectedCount;
  // A shipped roll is considered completed along the pipeline once it has at least 1 serial
  // and none of its serials remain in PENDING state.
  const isFullyResolved = totalSerials > 0 && pendingCount === 0;

  return {
    totalSerials,
    pendingCount,
    acceptedCount,
    cairCount,
    belumCairCount,
    rejectedCount,
    resolvedCount,
    isFullyResolved,
  };
}

/**
 * Splits shipped rolls (isSentToFactory === true) into:
 * - activePendingRolls: rolls still needing at least one status decision in Status Barang
 * - completedShippedRolls: rolls whose serials are all updated (Diterima/Reject) and progressed into Riwayat
 */
export function partitionShippedRolls(
  rollSamples: TobaccoRollSample[],
  finishedBatches: FinishedTobaccoSerial[]
): PartitionedShippedRolls {
  const activePendingRolls: TobaccoRollSample[] = [];
  const completedShippedRolls: TobaccoRollSample[] = [];

  for (const roll of rollSamples) {
    if (!roll.isSentToFactory) continue;
    const summary = getRollStatusSummary(roll, finishedBatches);
    if (summary.isFullyResolved) {
      completedShippedRolls.push(roll);
    } else {
      activePendingRolls.push(roll);
    }
  }

  return { activePendingRolls, completedShippedRolls };
}
