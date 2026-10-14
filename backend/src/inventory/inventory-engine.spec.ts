import { describe, expect, it } from 'vitest';
import {
  calculateStockVariances,
  compareInventoryRound,
  compareUnitSubmissions,
  parseCountSubmission,
  type ControllerInfo,
  type FrozenBaselineSnapshot,
  type ParsedSubmission,
} from './inventory-engine.js';

describe('Authoritative Inventory Engine', () => {
  const c1: ControllerInfo = { controllerId: 'c1', userId: 'u1', sequence: 0, round: 1 };
  const c2: ControllerInfo = { controllerId: 'c2', userId: 'u2', sequence: 1, round: 2 };
  const c3: ControllerInfo = { controllerId: 'c3', userId: 'u3', sequence: 2, round: 3 };
  const c4: ControllerInfo = { controllerId: 'c4', userId: 'u4', sequence: 3, round: 4 };

  const eqStandard = '11111111-1111-4111-8111-111111111111';
  const eqSerialized = '22222222-2222-4222-8222-222222222222';
  const shelfA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const shelfB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  describe('parseCountSubmission', () => {
    it('correctly parses standard observations with nonnegative integers', () => {
      const json = JSON.stringify({
        observations: [
          { equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 10 },
          { equipmentId: eqStandard, shelfId: shelfB, quantityCalculated: 5 },
        ],
      });

      const parsed = parseCountSubmission(json, 'c1', 'u1', new Date());
      expect(parsed.isSubmitted).toBe(true);
      expect(parsed.validationErrors).toHaveLength(0);
      expect(parsed.standardMap.get(`${eqStandard}|${shelfA}`)).toBe(10);
      expect(parsed.standardMap.get(`${eqStandard}|${shelfB}`)).toBe(5);
    });

    it('rejects negative or fractional quantities', () => {
      const json = JSON.stringify({
        observations: [
          { equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: -3 },
          { equipmentId: eqStandard, shelfId: shelfB, quantityCalculated: 4.5 },
        ],
      });

      const parsed = parseCountSubmission(json, 'c1', 'u1', new Date());
      expect(parsed.validationErrors.length).toBeGreaterThanOrEqual(2);
    });

    it('detects duplicate serial numbers inside a single submission', () => {
      const json = JSON.stringify({
        observations: [
          { scannedSerialCode: 'SN-001', shelfId: shelfA, observedEquipmentId: eqSerialized },
          { scannedSerialCode: 'SN-001', shelfId: shelfB, observedEquipmentId: eqSerialized },
        ],
      });

      const parsed = parseCountSubmission(json, 'c1', 'u1', new Date());
      expect(parsed.duplicatesDetected).toContain('SN-001');
      expect(parsed.validationErrors).toContain(
        'Numéro de série en double détecté dans la même soumission: SN-001',
      );
    });

    it('handles explicit zero confirmations without error', () => {
      const json = JSON.stringify({
        isExplicitEmpty: true,
        observations: [
          { equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 0, isExplicitZero: true },
        ],
      });

      const parsed = parseCountSubmission(json, 'c1', 'u1', new Date());
      expect(parsed.isExplicitEmpty).toBe(true);
      expect(parsed.validationErrors).toHaveLength(0);
      expect(parsed.standardMap.get(`${eqStandard}|${shelfA}`)).toBe(0);
    });
  });

  describe('Unanimity stopping condition (compareUnitSubmissions)', () => {
    it('rejects comparison when fewer than 3 controllers are assigned', () => {
      const controllers = [c1, c2]; // only 2
      const subs = new Map<string, ParsedSubmission>();
      subs.set('c1', parseCountSubmission('{"observations":[]}', 'c1', 'u1', new Date()));
      subs.set('c2', parseCountSubmission('{"observations":[]}', 'c2', 'u2', new Date()));

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.validationErrors).toContain('Au moins 3 contrôleurs sont requis');
      expect(result.status).toBe('PENDING');
    });

    it('remains PENDING when a 4th controller has not submitted', () => {
      const controllers = [c1, c2, c3, c4];
      const subs = new Map<string, ParsedSubmission>();
      const json = JSON.stringify({
        observations: [{ equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 10 }],
      });

      subs.set('c1', parseCountSubmission(json, 'c1', 'u1', new Date()));
      subs.set('c2', parseCountSubmission(json, 'c2', 'u2', new Date()));
      subs.set('c3', parseCountSubmission(json, 'c3', 'u3', new Date()));
      // c4 not submitted
      subs.set('c4', parseCountSubmission(json, 'c4', 'u4', null));

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.isComplete).toBe(false);
      expect(result.status).toBe('PENDING');
    });

    it('unanimous agreement across 4 controllers CONVERGES', () => {
      const controllers = [c1, c2, c3, c4];
      const subs = new Map<string, ParsedSubmission>();
      const json = JSON.stringify({
        observations: [{ equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 11 }],
      });

      for (const c of controllers) {
        subs.set(c.controllerId, parseCountSubmission(json, c.controllerId, c.userId, new Date()));
      }

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.isComplete).toBe(true);
      expect(result.isMatch).toBe(true);
      expect(result.status).toBe('CONVERGED');
      expect(result.disagreements).toHaveLength(0);
    });

    it('majority does NOT converge: 3 controllers count 10, 1 controller counts 12', () => {
      const controllers = [c1, c2, c3, c4];
      const subs = new Map<string, ParsedSubmission>();

      const json10 = JSON.stringify({
        observations: [{ equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 10 }],
      });
      const json12 = JSON.stringify({
        observations: [{ equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 12 }],
      });

      subs.set('c1', parseCountSubmission(json10, 'c1', 'u1', new Date()));
      subs.set('c2', parseCountSubmission(json10, 'c2', 'u2', new Date()));
      subs.set('c3', parseCountSubmission(json12, 'c3', 'u3', new Date())); // Divergent!
      subs.set('c4', parseCountSubmission(json10, 'c4', 'u4', new Date()));

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.isComplete).toBe(true);
      expect(result.isMatch).toBe(false);
      expect(result.status).toBe('RECOUNT_REQUIRED');
      expect(result.disagreements.length).toBeGreaterThan(0);
    });

    it('equal grand totals with different shelf locations disagree', () => {
      const controllers = [c1, c2, c3];
      const subs = new Map<string, ParsedSubmission>();

      // Total 10 on Shelf A
      const jsonShelfA = JSON.stringify({
        observations: [{ equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 10 }],
      });
      // Total 10 on Shelf B
      const jsonShelfB = JSON.stringify({
        observations: [{ equipmentId: eqStandard, shelfId: shelfB, quantityCalculated: 10 }],
      });

      subs.set('c1', parseCountSubmission(jsonShelfA, 'c1', 'u1', new Date()));
      subs.set('c2', parseCountSubmission(jsonShelfA, 'c2', 'u2', new Date()));
      subs.set('c3', parseCountSubmission(jsonShelfB, 'c3', 'u3', new Date()));

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.isMatch).toBe(false);
      expect(result.status).toBe('RECOUNT_REQUIRED');
    });

    it('equal serialized quantities with different serial codes disagree', () => {
      const controllers = [c1, c2, c3];
      const subs = new Map<string, ParsedSubmission>();

      const jsonSN1 = JSON.stringify({
        observations: [{ scannedSerialCode: 'SN-001', shelfId: shelfA, observedEquipmentId: eqSerialized }],
      });
      const jsonSN2 = JSON.stringify({
        observations: [{ scannedSerialCode: 'SN-002', shelfId: shelfA, observedEquipmentId: eqSerialized }],
      });

      subs.set('c1', parseCountSubmission(jsonSN1, 'c1', 'u1', new Date()));
      subs.set('c2', parseCountSubmission(jsonSN1, 'c2', 'u2', new Date()));
      subs.set('c3', parseCountSubmission(jsonSN2, 'c3', 'u3', new Date()));

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.isMatch).toBe(false);
      expect(result.status).toBe('RECOUNT_REQUIRED');
    });

    it('order of observations in JSON does not affect equality', () => {
      const controllers = [c1, c2, c3];
      const subs = new Map<string, ParsedSubmission>();

      const jsonOrder1 = JSON.stringify({
        observations: [
          { equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 5 },
          { equipmentId: eqStandard, shelfId: shelfB, quantityCalculated: 8 },
        ],
      });
      const jsonOrder2 = JSON.stringify({
        observations: [
          { equipmentId: eqStandard, shelfId: shelfB, quantityCalculated: 8 },
          { equipmentId: eqStandard, shelfId: shelfA, quantityCalculated: 5 },
        ],
      });

      subs.set('c1', parseCountSubmission(jsonOrder1, 'c1', 'u1', new Date()));
      subs.set('c2', parseCountSubmission(jsonOrder2, 'c2', 'u2', new Date()));
      subs.set('c3', parseCountSubmission(jsonOrder1, 'c3', 'u3', new Date()));

      const result = compareUnitSubmissions('unit-1', controllers, subs);
      expect(result.isMatch).toBe(true);
      expect(result.status).toBe('CONVERGED');
    });
  });

  describe('Stock variance vs Disagreement (calculateStockVariances)', () => {
    it('when all controllers agree on 11 but book stock is 12, marks SHORTAGE without blocking convergence', () => {
      const baseline: FrozenBaselineSnapshot = {
        version: 1,
        frozenAt: new Date().toISOString(),
        typeInventory: 'ByEquipment',
        scope: { equipmentIds: [eqStandard], shelfIds: [] },
        standardItems: [
          { equipmentId: eqStandard, shelfId: shelfA, expectedQuantity: 12 },
        ],
        serializedItems: [],
      };

      const acceptedObservations = new Map([
        [
          'unit-1',
          [
            {
              kind: 'STANDARD' as const,
              equipmentId: eqStandard,
              shelfId: shelfA,
              quantity: 11,
            },
          ],
        ],
      ]);

      const variances = calculateStockVariances(acceptedObservations, baseline);
      expect(variances).toHaveLength(1);
      expect(variances[0].varianceType).toBe('SHORTAGE');
      expect(variances[0].expectedQuantity).toBe(12);
      expect(variances[0].observedQuantity).toBe(11);
      expect(variances[0].deltaQuantity).toBe(-1);
    });

    it('detects serialized location mismatch between baseline shelf and physical shelf', () => {
      const baseline: FrozenBaselineSnapshot = {
        version: 1,
        frozenAt: new Date().toISOString(),
        typeInventory: 'ByEquipment',
        scope: { equipmentIds: [eqSerialized], shelfIds: [] },
        standardItems: [],
        serializedItems: [
          {
            serialNumberId: 's1',
            serialNumberCode: 'SN-100',
            equipmentId: eqSerialized,
            expectedShelfId: shelfA,
          },
        ],
      };

      const acceptedObservations = new Map([
        [
          'unit-1',
          [
            {
              kind: 'SERIALIZED' as const,
              equipmentId: eqSerialized,
              shelfId: shelfB, // Observed on Shelf B instead of Shelf A!
              quantity: 1,
              serialNumberCode: 'SN-100',
              serialNumberId: 's1',
            },
          ],
        ],
      ]);

      const variances = calculateStockVariances(acceptedObservations, baseline);
      expect(variances).toHaveLength(1);
      expect(variances[0].varianceType).toBe('LOCATION_MISMATCH');
      expect(variances[0].expectedShelfId).toBe(shelfA);
      expect(variances[0].observedShelfId).toBe(shelfB);
    });
  });

  describe('Full Acceptance Workflow Example (Section 3)', () => {
    it('simulates 4-controller progression: Round 1 (10,10,12,10) -> disagree; Round 2 (11,11,10,11) -> disagree; Round 3 (11,11,11,11) -> converge', () => {
      const controllers = [c1, c2, c3, c4];
      const units = [{ unitId: 'unit-1', equipmentId: eqStandard, shelfId: null }];

      // Round 1
      const r1Subs = new Map<string, Map<string, ParsedSubmission>>([
        [
          'unit-1',
          new Map([
            ['c1', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":10}]}', 'c1', 'u1', new Date())],
            ['c2', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":10}]}', 'c2', 'u2', new Date())],
            ['c3', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":12}]}', 'c3', 'u3', new Date())],
            ['c4', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":10}]}', 'c4', 'u4', new Date())],
          ]),
        ],
      ]);
      const r1 = compareInventoryRound(units, controllers, r1Subs);
      expect(r1.status).toBe('RECOUNT_REQUIRED');
      expect(r1.isUnanimous).toBe(false);

      // Round 2
      const r2Subs = new Map<string, Map<string, ParsedSubmission>>([
        [
          'unit-1',
          new Map([
            ['c1', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c1', 'u1', new Date())],
            ['c2', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c2', 'u2', new Date())],
            ['c3', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":10}]}', 'c3', 'u3', new Date())],
            ['c4', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c4', 'u4', new Date())],
          ]),
        ],
      ]);
      const r2 = compareInventoryRound(units, controllers, r2Subs);
      expect(r2.status).toBe('RECOUNT_REQUIRED');
      expect(r2.isUnanimous).toBe(false);

      // Round 3
      const r3Subs = new Map<string, Map<string, ParsedSubmission>>([
        [
          'unit-1',
          new Map([
            ['c1', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c1', 'u1', new Date())],
            ['c2', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c2', 'u2', new Date())],
            ['c3', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c3', 'u3', new Date())],
            ['c4', parseCountSubmission('{"observations":[{"equipmentId":"' + eqStandard + '","shelfId":"' + shelfA + '","quantityCalculated":11}]}', 'c4', 'u4', new Date())],
          ]),
        ],
      ]);
      const r3 = compareInventoryRound(units, controllers, r3Subs);
      expect(r3.status).toBe('CONVERGED');
      expect(r3.isUnanimous).toBe(true);
      expect(r3.acceptedObservationsByUnit.get('unit-1')?.[0].quantity).toBe(11);
    });
  });
});
