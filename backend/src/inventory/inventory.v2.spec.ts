import { describe, expect, it } from 'vitest';
import {
  calculateStockVariances,
  compareUnitSubmissions,
  parseCountSubmission,
} from './inventory-engine.js';

describe('Inventory Acceptance Example - 4 Controllers across 3 Rounds', () => {
  const unitId = 'unit-1';
  const equipmentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const shelfId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  const controllers = [
    { controllerId: 'c1', userId: 'u1', sequence: 0 },
    { controllerId: 'c2', userId: 'u2', sequence: 1 },
    { controllerId: 'c3', userId: 'u3', sequence: 2 },
    { controllerId: 'c4', userId: 'u4', sequence: 3 },
  ];

  it('Round 1: 10, 10, 12, 10 -> disagreement requires recount child', () => {
    const submissions = new Map([
      [
        'c1',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }),
          'c1',
          'u1',
          new Date(),
        ),
      ],
      [
        'c2',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }),
          'c2',
          'u2',
          new Date(),
        ),
      ],
      [
        'c3',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 12 }] }),
          'c3',
          'u3',
          new Date(),
        ),
      ],
      [
        'c4',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }),
          'c4',
          'u4',
          new Date(),
        ),
      ],
    ]);

    const res = compareUnitSubmissions(unitId, controllers, submissions);
    expect(res.isComplete).toBe(true);
    expect(res.isMatch).toBe(false);
    expect(res.status).toBe('RECOUNT_REQUIRED');
    expect(res.disagreements.length).toBeGreaterThan(0);
  });

  it('Round 2: 11, 11, 10, 11 -> disagreement requires recount child', () => {
    const submissions = new Map([
      [
        'c1',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c1',
          'u1',
          new Date(),
        ),
      ],
      [
        'c2',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c2',
          'u2',
          new Date(),
        ),
      ],
      [
        'c3',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 10 }] }),
          'c3',
          'u3',
          new Date(),
        ),
      ],
      [
        'c4',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c4',
          'u4',
          new Date(),
        ),
      ],
    ]);

    const res = compareUnitSubmissions(unitId, controllers, submissions);
    expect(res.isComplete).toBe(true);
    expect(res.isMatch).toBe(false);
    expect(res.status).toBe('RECOUNT_REQUIRED');
  });

  it('Round 3: 11, 11, 11, 11 -> unanimous convergence achieved', () => {
    const submissions = new Map([
      [
        'c1',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c1',
          'u1',
          new Date(),
        ),
      ],
      [
        'c2',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c2',
          'u2',
          new Date(),
        ),
      ],
      [
        'c3',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c3',
          'u3',
          new Date(),
        ),
      ],
      [
        'c4',
        parseCountSubmission(
          JSON.stringify({ observations: [{ equipmentId, shelfId, quantityCalculated: 11 }] }),
          'c4',
          'u4',
          new Date(),
        ),
      ],
    ]);

    const res = compareUnitSubmissions(unitId, controllers, submissions);
    expect(res.isComplete).toBe(true);
    expect(res.isMatch).toBe(true);
    expect(res.status).toBe('CONVERGED');
    expect(res.disagreements).toHaveLength(0);
  });

  it('Unanimous count differing from book stock creates shortage variance without forcing endless recount', () => {
    // Every controller counts 11, baseline book stock is 12
    const acceptedByUnit = new Map([
      [unitId, [{ kind: 'STANDARD' as const, equipmentId, shelfId, quantity: 11 }]],
    ]);
    const baseline = {
      standardItems: [{ equipmentId, shelfId, expectedQuantity: 12 }],
      serializedItems: [],
    };

    const variances = calculateStockVariances(acceptedByUnit, baseline);

    expect(variances).toHaveLength(1);
    expect(variances[0].varianceType).toBe('SHORTAGE');
    expect(variances[0].deltaQuantity).toBe(-1); // 11 - 12 = -1 shortage
    expect(variances[0].observedQuantity).toBe(11);
    expect(variances[0].expectedQuantity).toBe(12);
  });
});
