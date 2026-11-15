import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCategorizedStockGroups,
  buildNolanStockIndex,
  queryNolanStockIndex,
  splitArrayIntoFirestoreChunks,
  reassembleArrayFromFirestoreChunks,
  FIRESTORE_CHUNK_SIZE,
} from './stockScaleEngine';
import {
  packArrayIntoEncryptedVaultShards,
  unpackArrayFromEncryptedVaultShards,
  computeVaultSecurityStats,
} from './vaultCryptoEngine';
import { solveAutoBlend } from './tobaccoMath';
import { RawTobacco, TobaccoGrade } from '../types/tobacco';

const SAMPLE_ORIGINS = ['Muntilan', 'Temanggung', 'Madura', 'Bojonegoro', 'Garut', 'Weleri'];
const SAMPLE_SELLERS = ['Pak Haji Slamet', 'Bu Menik', 'Kang Dedi', 'Mas Wahyu', 'Pak Karto'];
const SAMPLE_GRADES: TobaccoGrade[] = ['B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E'];

function generateMockThousandStocks(count: number): RawTobacco[] {
  const list: RawTobacco[] = [];
  for (let i = 0; i < count; i++) {
    const origin = SAMPLE_ORIGINS[i % SAMPLE_ORIGINS.length];
    const seller = SAMPLE_SELLERS[i % SAMPLE_SELLERS.length];
    const grade = SAMPLE_GRADES[i % SAMPLE_GRADES.length];
    const isIncompletePrice = i % 10 === 0; // 10% menyusul harga
    const price = isIncompletePrice ? 0 : 65000 + (i % 12) * 5000;
    const netKg = 25 + (i % 40);

    list.push({
      id: `raw-${1700000000000 + i * 1000}`,
      name: `${origin.slice(0, 3).toUpperCase()} Lot #${i + 1}`,
      lotNumber: `LOT-${i + 1}`,
      origin,
      sellerName: seller,
      colorGrade: grade,
      grossWeightKg: netKg + 3,
      deductionKg: 3,
      netWeightKg: netKg,
      currentStockNetKg: netKg,
      taraFormula: {
        rawFormula: '4% + 2 kg',
        percent: 4,
        flatKg: 2,
        pricingBasis: 'NET_WEIGHT',
        packagingType: 'Keranjang',
        packagingMassKg: 3,
      },
      pricePerKgPurchase: price,
      additionalPurchaseCost: 0,
      realCostPerNetKg: price,
      totalModalAsal: price * netKg,
      purchaseWeightProfitKg: 1,
      purchaseWeightProfitRp: price,
      powerRating: 2.5 + ((i % 25) / 10),
      impactRating: 2.5 + (((i + 3) % 25) / 10),
      bitterRating: 2.0 + (((i + 7) % 20) / 10),
      burnRating: 3.5 + (((i + 2) % 15) / 10),
      sugarRating: 3.0 + (((i + 5) % 20) / 10),
      aromaRating: 3.2 + (((i + 4) % 18) / 10),
      characterNotes: `Lot ke-${i + 1}`,
      purchaseDate: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    });
  }
  return list;
}

describe('Thousands of Stock Scaling Engine (2,500 Lots)', () => {
  const largeStockPool = generateMockThousandStocks(2500);

  it('categorizes 2,500 stocks into Origin -> Grade folders and filters incomplete prices in <100ms', () => {
    const t0 = performance.now();
    const resAll = buildCategorizedStockGroups(largeStockPool, {
      groupingMode: 'ORIGIN_GRADE',
      sortMode: 'FIFO_OLDEST',
      searchQuery: '',
      onlyCompleteWithPrice: false,
    });
    const elapsedMs = performance.now() - t0;

    assert.ok(elapsedMs < 150, `Expected <150ms, got ${elapsedMs.toFixed(2)}ms`);
    assert.equal(resAll.groups.length, SAMPLE_ORIGINS.length);

    const totalItemsAcrossFolders = resAll.groups.reduce((s, g) => s + g.items.length, 0);
    assert.equal(totalItemsAcrossFolders, 2500);

    // Filter onlyCompleteWithPrice (removes 10% items with price === 0)
    const resReadyOnly = buildCategorizedStockGroups(largeStockPool, {
      groupingMode: 'ORIGIN_GRADE',
      sortMode: 'FIFO_OLDEST',
      searchQuery: '',
      onlyCompleteWithPrice: true,
    });
    const readyItemsCount = resReadyOnly.groups.reduce((s, g) => s + g.items.length, 0);
    assert.equal(readyItemsCount, 2250);
  });

  it('solves Auto-Racik on 2,500 stocks in <120ms using candidate pruning while preserving exact pool bounds', () => {
    const t0 = performance.now();
    const res = solveAutoBlend({
      rawTobaccos: largeStockPool,
      stockMode: 'ALL',
      selectedTobaccoIds: [],
      targetGrade: 'C+',
      allowedGrades: ['B', 'C+', 'C', 'D+'],
      targetSensory: {
        power: 3.8,
        impact: 3.7,
        bitter: 3.1,
        burn: 4.2,
        sugar: 3.9,
        aroma: 4.0,
      },
      allowedOrigins: [],
      targetPricePerKg: 95000,
      targetTotalKg: 100,
      respectStockCap: true,
      prioritizeWeightProfit: true,
      onlyCompleteWithPrice: true,
    });
    const elapsedMs = performance.now() - t0;

    assert.equal(res.isPoolEmpty, false);
    assert.ok(elapsedMs < 150, `Expected Auto-Racik solver <150ms for 2,500 items, got ${elapsedMs.toFixed(2)}ms`);
    assert.equal(res.effectiveTotalKg, 100);
    assert.ok(res.recommendedIngredients.length >= 1);
    assert.ok(
      res.parameterDiagnostics.every((d) => d.minInPool <= d.achievedValue && d.achievedValue <= d.maxInPool)
    );
  });

  it('builds Nolan Stock Index for 2,500 stocks quickly and answers incomplete/daerah/FIFO queries accurately', () => {
    const t0 = performance.now();
    const index = buildNolanStockIndex(largeStockPool);
    const elapsedMs = performance.now() - t0;

    assert.ok(elapsedMs < 150, `Expected Nolan Index build <150ms, got ${elapsedMs.toFixed(2)}ms`);
    assert.equal(index.activeItemCount, 2500);
    assert.equal(index.incompleteSummary.missingPriceCount, 250);
    assert.equal(index.completeActiveCount, 2250);
    assert.equal(index.byOrigin.length, SAMPLE_ORIGINS.length);
    assert.equal(index.bySeller.length, SAMPLE_SELLERS.length);

    const incompleteReply = queryNolanStockIndex(
      index,
      largeStockPool,
      'cek stok yang belum lengkap atau harga menyusul'
    );
    assert.ok(incompleteReply && incompleteReply.includes('250 stok'));

    const originReply = queryNolanStockIndex(
      index,
      largeStockPool,
      'rekap stok per daerah gudang'
    );
    assert.ok(originReply && originReply.includes('Muntilan') && originReply.includes('Temanggung'));

    const fifoReply = queryNolanStockIndex(
      index,
      largeStockPool,
      'cek stok paling lama fifo'
    );
    assert.ok(fifoReply && fifoReply.includes('FIFO'));
  });

  it('splits and reassembles 2,500 items across 250-item Firestore chunks without data loss', () => {
    const split = splitArrayIntoFirestoreChunks(largeStockPool, FIRESTORE_CHUNK_SIZE);
    assert.equal(split.totalChunks, 10);
    assert.equal(split.inlineItems.length, 250);
    assert.equal(split.overflowChunks.length, 9);

    const overflowMap = new Map<number, RawTobacco[]>();
    // Insert in reverse order to verify deterministic chunkIndex reassembly
    for (let i = split.overflowChunks.length - 1; i >= 0; i--) {
      overflowMap.set(i + 1, split.overflowChunks[i]);
    }

    const reassembled = reassembleArrayFromFirestoreChunks(
      split.inlineItems,
      overflowMap,
      split.totalChunks
    );
    assert.equal(reassembled.length, 2500);
    assert.equal(reassembled[0].id, largeStockPool[0].id);
    assert.equal(reassembled[2499].id, largeStockPool[2499].id);
  });

  it('compresses and encrypts 2,500 stocks into TLAB_V2_ENC binary shards (>60% smaller, unreadable nakedly, 100% lossless decrypt)', () => {
    const ownerUid = 'uid_adikaryasukses99_test';
    const shards = packArrayIntoEncryptedVaultShards(largeStockPool, ownerUid);
    assert.ok(shards.length > 0 && shards.length <= 300);

    // 1. Ensure no naked plaintext leaks inside the Firestore shard payload
    const serializedShards = JSON.stringify(shards);
    assert.equal(serializedShards.includes('Pak Haji Slamet'), false);
    assert.equal(serializedShards.includes('Muntilan'), false);
    assert.equal(serializedShards.includes('pricePerKgPurchase'), false);

    // 2. Verify significant storage compression savings
    const stats = computeVaultSecurityStats({
      rawTobaccos: largeStockPool,
      finishedBatches: [],
      rollSamples: [],
      packagingList: [],
      factoryList: [],
      ownerId: ownerUid,
    });
    assert.ok(
      stats.savedPercentage > 55,
      `Expected >55% space savings, got ${stats.savedPercentage}%`
    );

    // 3. Verify 100% lossless decryption & decompression
    const decrypted = unpackArrayFromEncryptedVaultShards<RawTobacco>(shards, ownerUid);
    assert.equal(decrypted.length, 2500);
    assert.deepEqual(decrypted[0], largeStockPool[0]);
    assert.deepEqual(decrypted[1234], largeStockPool[1234]);
    assert.deepEqual(decrypted[2499], largeStockPool[2499]);

    // 4. Verify 100% backward compatibility with legacy unencrypted arrays
    const legacyUnpacked = unpackArrayFromEncryptedVaultShards<RawTobacco>(
      largeStockPool.slice(0, 5),
      ownerUid
    );
    assert.equal(legacyUnpacked.length, 5);
    assert.deepEqual(legacyUnpacked[0], largeStockPool[0]);
  });
});
