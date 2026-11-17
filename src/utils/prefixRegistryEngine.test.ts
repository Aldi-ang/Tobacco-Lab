import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCustomGenerationPrefixFromLot,
  getPrefixStartSequence,
  mergeRegistryWithDiscoveredPrefixes,
  normalizePrefixInput,
  recordPrintedBatchToPrefixRegistry,
  registerNewPrefix,
  removeRegisteredPrefix,
  selectActivePrefix,
  setPrefixStartSequence,
} from './prefixRegistryEngine';
import { extractLotPrefixCode } from './thermalPrintEngine';
import { RawTobacco } from '../types/tobacco';

const makeMockTobacco = (id: string, lotNumber: string): RawTobacco => ({
  id,
  lotNumber,
  name: 'Mock',
  origin: 'Muntilan',
  purchaseDate: '2026-11-15',
  grossWeightKg: 50,
  packagingMassKg: 3,
  taraFormula: {
    rawFormula: '0% + 3 kg',
    percent: 0,
    flatKg: 3,
    pricingBasis: 'NET_WEIGHT',
    packagingType: 'KRJ MUNTILAN',
    packagingMassKg: 3,
  },
  deductionKg: 3,
  netWeightKg: 47,
  currentStockNetKg: 47,
  pricePerKgPurchase: 80000,
  totalAgentFeePerKg: 0,
  totalAgentFeeRp: 0,
  additionalPurchaseCost: 0,
  totalModalAsal: 3760000,
  realCostPerNetKg: 80000,
  realNetWeightKg: 47,
  realStockValueRp: 3760000,
  purchaseWeightProfitKg: 0,
  purchaseWeightProfitRp: 0,
  effectiveCostPerRealKg: 80000,
  powerRating: 3,
  impactRating: 3,
  bitterRating: 3,
  burnRating: 4,
  sugarRating: 3,
  aromaRating: 4,
  colorGrade: 'D',
  characterNotes: '',
});

test('normalizePrefixInput cleans whitespace and symbols while keeping trailing hyphen option', () => {
  assert.equal(normalizePrefixInput(' mtl '), 'MTL');
  assert.equal(normalizePrefixInput('tmg-'), 'TMG-');
  assert.equal(normalizePrefixInput('wds 01!'), 'WDS01');
});

test('extractLotPrefixCode and extractCustomGenerationPrefixFromLot handle MTL001 and TMG-009', () => {
  assert.equal(extractLotPrefixCode('MTL001'), 'MTL');
  assert.equal(extractLotPrefixCode('TMG-009'), 'TMG');
  assert.equal(extractCustomGenerationPrefixFromLot('MTL001'), 'MTL');
  assert.equal(extractCustomGenerationPrefixFromLot('TMG-009'), 'TMG-');
  assert.equal(extractCustomGenerationPrefixFromLot('LOT-261115-001'), null);
});

test('registerNewPrefix saves custom prefix and auto-selects it as lastSelectedPrefix', () => {
  const initial = { registeredPrefixes: [], lastSelectedPrefix: '' };
  const { nextState: s1, normalizedPrefix } = registerNewPrefix(initial, 'mtl');
  assert.equal(normalizedPrefix, 'MTL');
  assert.deepEqual(s1.registeredPrefixes, ['MTL']);
  assert.equal(s1.lastSelectedPrefix, 'MTL');

  const { nextState: s2 } = registerNewPrefix(s1, 'TMG-');
  assert.deepEqual(s2.registeredPrefixes, ['TMG-', 'MTL']);
  assert.equal(s2.lastSelectedPrefix, 'TMG-');

  const s3 = selectActivePrefix(s2, 'MTL');
  assert.equal(s3.lastSelectedPrefix, 'MTL');
  assert.deepEqual(s3.registeredPrefixes, ['TMG-', 'MTL']);
});

test('recordPrintedBatchToPrefixRegistry remembers printed prefix and preserves auto-selection', () => {
  const start = { registeredPrefixes: ['MTL'], lastSelectedPrefix: 'MTL' };
  const afterDaily = recordPrintedBatchToPrefixRegistry(
    start,
    ['LOT-261115-001', 'LOT-261115-002'],
    ''
  );
  assert.equal(afterDaily.lastSelectedPrefix, '');
  assert.deepEqual(afterDaily.registeredPrefixes, ['MTL']);

  const afterWds = recordPrintedBatchToPrefixRegistry(
    afterDaily,
    ['WDS001', 'WDS002'],
    'WDS'
  );
  assert.equal(afterWds.lastSelectedPrefix, 'WDS');
  assert.deepEqual(afterWds.registeredPrefixes, ['WDS', 'MTL']);
});

test('mergeRegistryWithDiscoveredPrefixes discovers prefixes from warehouse stocks and locked lots', () => {
  const merged = mergeRegistryWithDiscoveredPrefixes(
    { registeredPrefixes: ['MTL'], lastSelectedPrefix: 'MTL' },
    [makeMockTobacco('1', 'BOJ-003')],
    ['TMG001', 'LOT-261115-001']
  );
  assert.deepEqual(merged.registeredPrefixes, ['MTL', 'TMG', 'BOJ-']);
  assert.equal(merged.lastSelectedPrefix, 'MTL');

  const afterDelete = removeRegisteredPrefix(merged, 'MTL');
  assert.deepEqual(afterDelete.registeredPrefixes, ['TMG', 'BOJ-']);
  assert.equal(afterDelete.lastSelectedPrefix, '');

  // Even when re-merging with issuedPrintedLots or stocks containing MTL, dismissed prefix stays deleted
  const remergedAfterDelete = mergeRegistryWithDiscoveredPrefixes(
    afterDelete,
    [makeMockTobacco('1', 'BOJ-003'), makeMockTobacco('2', 'MTL002')],
    ['MTL001', 'TMG001']
  );
  assert.deepEqual(remergedAfterDelete.registeredPrefixes, ['TMG', 'BOJ-']);
  assert.equal(remergedAfterDelete.lastSelectedPrefix, '');

  // Deleting TMG too stays deleted across merges
  const deleteTmg = removeRegisteredPrefix(remergedAfterDelete, 'TMG');
  const remergedAfterTmg = mergeRegistryWithDiscoveredPrefixes(
    deleteTmg,
    [makeMockTobacco('1', 'BOJ-003')],
    ['MTL001', 'TMG001']
  );
  assert.deepEqual(remergedAfterTmg.registeredPrefixes, ['BOJ-']);

  // User can explicitly re-register MTL later with custom skip number (e.g. 19) to resume paper numbering
  const { nextState: readded } = registerNewPrefix(remergedAfterTmg, 'MTL', 19);
  assert.equal(readded.lastSelectedPrefix, 'MTL');
  assert.deepEqual(readded.registeredPrefixes, ['MTL', 'BOJ-']);
  assert.equal(getPrefixStartSequence(readded, 'MTL'), 19);

  // Skip number persists across merges & can be updated or cleared cleanly
  const afterMerge = mergeRegistryWithDiscoveredPrefixes(readded, [], []);
  assert.equal(getPrefixStartSequence(afterMerge, 'MTL'), 19);

  const bumped = setPrefixStartSequence(afterMerge, 'MTL', 25);
  assert.equal(getPrefixStartSequence(bumped, 'MTL'), 25);

  const reset = setPrefixStartSequence(bumped, 'MTL', null);
  assert.equal(getPrefixStartSequence(reset, 'MTL'), null);
});
