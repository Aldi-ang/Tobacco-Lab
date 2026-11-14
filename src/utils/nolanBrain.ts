import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  FactoryMaster,
} from '../types/tobacco';
import {
  NolanBrainMemory,
  NolanDecisionEpisode,
  NolanFactoryPreference,
} from '../types/nolan';

export const NOLAN_STORAGE_KEY_PREFIX = 'kretek_master_nolan_brain_v1_';

export function getNolanStorageKey(accountEmail?: string | null): string {
  const clean = (accountEmail || 'local_default').trim().toLowerCase();
  return `${NOLAN_STORAGE_KEY_PREFIX}${clean}`;
}

export function deriveFactoryProfilesFromData(
  finishedBatches: FinishedTobaccoSerial[],
  factoryList: FactoryMaster[]
): NolanFactoryPreference[] {
  const allFactoryNames = Array.from(
    new Set([
      ...factoryList.map((f) => f.name),
      ...finishedBatches.map((b) => b.targetFactory).filter(Boolean),
    ])
  );

  return allFactoryNames.map((factoryName) => {
    const serials = finishedBatches.filter(
      (b) => b.targetFactory?.toLowerCase() === factoryName.toLowerCase()
    );
    const accepted = serials.filter((b) => b.factoryStatus === 'ACCEPTED_CAIR');
    const rejected = serials.filter((b) => b.factoryStatus === 'REJECTED_STOCK');
    const pool = accepted.length > 0 ? accepted : serials;

    const grades = Array.from(
      new Set(pool.map((s) => s.compositeColorGrade).filter(Boolean))
    );
    const avgHpp =
      pool.length > 0
        ? Math.round(pool.reduce((sum, s) => sum + (s.hppPerNetKg || 0), 0) / pool.length)
        : 0;
    const avgPrice =
      pool.length > 0
        ? Math.round(
            pool.reduce((sum, s) => sum + (s.factoryTargetPricePerKg || 0), 0) / pool.length
          )
        : 0;

    const avgPower =
      pool.length > 0
        ? (pool.reduce((sum, s) => sum + (s.weightedPower || 0), 0) / pool.length).toFixed(1)
        : '-';
    const avgSugar =
      pool.length > 0
        ? (pool.reduce((sum, s) => sum + (s.weightedSugar || 0), 0) / pool.length).toFixed(1)
        : '-';
    const avgAroma =
      pool.length > 0
        ? (pool.reduce((sum, s) => sum + (s.weightedAroma || 4.2), 0) / pool.length).toFixed(1)
        : '-';

    return {
      factoryName,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      preferredGrades: grades.length > 0 ? grades : ['D', 'E'],
      avgAcceptedHppPerKg: avgHpp,
      avgTargetPricePerKg: avgPrice,
      sensorySweetSpot:
        pool.length > 0
          ? `Power ${avgPower}/5 • Sugar ${avgSugar}/5 • Aroma ${avgAroma}/5`
          : 'Belum ada histori seri',
      notes:
        accepted.length > 0
          ? `${accepted.length} seri Diterima/Accepted, rata-rata margin positif.`
          : rejected.length > 0
            ? `Perhatian: ${rejected.length} seri pernah di-reject di pabrik ini.`
            : 'Siap menerima pengiriman gulungan sampel baru.',
    };
  });
}

export function buildDefaultNolanBrain(
  accountEmail: string | null,
  rawTobaccos: RawTobacco[],
  finishedBatches: FinishedTobaccoSerial[],
  factoryList: FactoryMaster[]
): NolanBrainMemory {
  const initialEpisodes: NolanDecisionEpisode[] = finishedBatches
    .slice(0, 12)
    .map((ser) => {
      const status = ser.factoryStatus || 'WAITING_FACTORY';
      const ingSummary = (ser.ingredients || [])
        .map((i) => `${i.tobaccoName} (${i.usedNetKg}kg)`)
        .join(' + ');
      return {
        id: `init-ep-${ser.id}`,
        timestamp: ser.createdAt || new Date().toISOString(),
        type:
          status === 'ACCEPTED_CAIR'
            ? 'FACTORY_ACCEPTED'
            : status === 'REJECTED_STOCK'
              ? 'FACTORY_REJECTED'
              : 'BLEND_CREATED',
        summary: `Seri ${ser.serialNumber} (${ser.recipeName}) → ${ser.targetFactory} [Grade ${ser.compositeColorGrade}]`,
        factoryName: ser.targetFactory,
        recipeName: ser.recipeName,
        grade: ser.compositeColorGrade,
        hppPerKg: ser.hppPerNetKg,
        targetPricePerKg: ser.factoryTargetPricePerKg,
        ingredientsSummary: ingSummary,
        learnedTakeaway:
          status === 'ACCEPTED_CAIR'
            ? `Komposisi ${ingSummary} diterima baik oleh ${ser.targetFactory} pada HPP Rp ${(ser.hppPerNetKg || 0).toLocaleString('id-ID')}/kg.`
            : status === 'REJECTED_STOCK'
              ? `Seri ${ser.serialNumber} direject oleh ${ser.targetFactory}; evaluasi ulang grade/komposisi untuk pengiriman berikutnya.`
              : `Racikan ${ser.recipeName} menggunakan ${ingSummary} dengan target jual Rp ${(ser.factoryTargetPricePerKg || 0).toLocaleString('id-ID')}/kg.`,
      };
    });

  return {
    agentName: 'Nolan',
    version: '1.0.0',
    accountEmail: accountEmail || 'adikaryasukses99@gmail.com',
    lastUpdated: new Date().toISOString(),
    githubRepo: 'Aldi-ang/A-Brain',
    githubBranch: 'main',
    githubFilePath: 'Tobacco-Business/nolan-brain.json',
    autoSyncGithub: true,
    learnedRules: [
      'Utamakan bahan dengan Sisa Stok Gudang (currentStockNetKg) yang cukup dan HPP Bersih/kg (realCostPerNetKg) efisien agar margin profit pabrik > 22%.',
      'Perhitungkan selalu Fee Perantara (Netto × Fee/KG) sebagai tambahan modal dalam HPP dasar setiap bahan mentah.',
      'Seimbangkan tembakau berkarakter Power/Impact kuat (Temanggung/Muntilan) dengan tembakau ber-Sugar/Burn halus (Garut/Madura/Paiton) sesuai selera pabrik tujuan.',
      'Prioritaskan pemanfaatan stok yang memberi Weight Profit (selisih Netto Riil vs Netto Nota) tinggi untuk mendongkrak keuntungan timbangan.',
    ],
    decisionEpisodes: initialEpisodes,
    factoryProfiles: deriveFactoryProfilesFromData(finishedBatches, factoryList),
  };
}

export function computeAccountSummaryForABrain(
  rawTobaccos: RawTobacco[],
  finishedBatches: FinishedTobaccoSerial[],
  rollSamples: TobaccoRollSample[]
) {
  const totalRawNetKg = Number(
    rawTobaccos.reduce((s, t) => s + (t.currentStockNetKg || 0), 0).toFixed(1)
  );
  const totalModalRp = Math.round(
    rawTobaccos.reduce((s, t) => s + (t.totalModalAsal || 0), 0)
  );
  const totalWeightProfitRp = Math.round(
    rawTobaccos.reduce((s, t) => s + (t.purchaseWeightProfitRp || 0), 0)
  );
  const totalWeightProfitKg = Number(
    rawTobaccos.reduce((s, t) => s + (t.purchaseWeightProfitKg || 0), 0).toFixed(1)
  );

  const accepted = finishedBatches.filter((b) => b.factoryStatus === 'ACCEPTED_CAIR');
  const rejected = finishedBatches.filter((b) => b.factoryStatus === 'REJECTED_STOCK');
  const acceptedProfitRp = Math.round(
    accepted.reduce((s, b) => s + (b.projectedProfit || 0), 0)
  );

  return {
    rawCount: rawTobaccos.length,
    totalRawNetKg,
    totalModalRp,
    totalWeightProfitRp,
    totalWeightProfitKg,
    finishedCount: finishedBatches.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    acceptedProfitRp,
    rollCount: rollSamples.length,
  };
}
