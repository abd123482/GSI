import { describe, expect, it } from 'vitest';
import {
  calculateStockVariances,
  compareInventoryRound,
  compareUnitSubmissions,
  parseCountSubmission,
  ControllerInfo,
  FrozenBaselineSnapshot,
  NormalizedObservation,
  ParsedSubmission,
} from './inventory-engine.js';

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

describe('Inventory Redesign Benchmark - Ordinary & Scaled Datasets', () => {
  it('benchmarks engine comparison on ordinary dataset (50 units, 4 controllers)', () => {
    const unitCount = 50;
    const controllerCount = 4;
    const iterations = 50;
    const timings: number[] = [];

    const controllers: ControllerInfo[] = [];
    for (let c = 0; c < controllerCount; c++) {
      controllers.push({
        controllerId: `c-${c}`,
        userId: `u-${c}`,
        sequence: c,
        round: c + 1,
      });
    }

    // Setup ordinary dataset
    const units: Array<{ unitId: string; equipmentId: string; shelfId: string }> = [];
    const unitSubmissions = new Map<string, Map<string, ParsedSubmission>>();

    for (let u = 0; u < unitCount; u++) {
      const unitId = `unit-${u}`;
      const equipmentId = `11111111-1111-4111-8111-${String(u).padStart(12, '0')}`;
      const shelfId = `22222222-2222-4222-8222-${String(u % 5).padStart(12, '0')}`;
      units.push({ unitId, equipmentId, shelfId });

      const subMap = new Map<string, ParsedSubmission>();
      for (const ctrl of controllers) {
        const payload = JSON.stringify({
          observations: [
            {
              equipmentId,
              shelfId,
              quantityCalculated: 12,
            },
            {
              equipmentId,
              shelfId,
              quantityCalculated: 1,
              serialNumberCode: `SN-ORD-${u}`,
            },
          ],
        });
        subMap.set(ctrl.controllerId, parseCountSubmission(payload, ctrl.controllerId, ctrl.userId, new Date()));
      }
      unitSubmissions.set(unitId, subMap);
    }

    // Measure iterations
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = compareInventoryRound(units, controllers, unitSubmissions);
      expect(res.status).toBe('CONVERGED');
      expect(res.isUnanimous).toBe(true);
      timings.push(performance.now() - start);
    }

    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    console.log(
      `[Ordinary Dataset (50 units x 4 controllers)] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms across ${iterations} iterations`,
    );
    expect(p95).toBeLessThan(100);
  });

  it('benchmarks engine comparison on large dataset (1,000 units, 10 controllers = 10,000 count attempts)', () => {
    const unitCount = 1000;
    const controllerCount = 10;
    const iterations = 10;
    const timings: number[] = [];

    const controllers: ControllerInfo[] = [];
    for (let c = 0; c < controllerCount; c++) {
      controllers.push({
        controllerId: `c-${c}`,
        userId: `u-${c}`,
        sequence: c,
        round: c + 1,
      });
    }

    const units: Array<{ unitId: string; equipmentId: string; shelfId: string }> = [];
    const unitSubmissions = new Map<string, Map<string, ParsedSubmission>>();

    for (let u = 0; u < unitCount; u++) {
      const unitId = `unit-${u}`;
      const equipmentId = `33333333-3333-4333-8333-${String(u % 20).padStart(12, '0')}`;
      const shelfId = `44444444-4444-4444-8444-${String(u % 10).padStart(12, '0')}`;
      units.push({ unitId, equipmentId, shelfId });

      const subMap = new Map<string, ParsedSubmission>();
      for (const ctrl of controllers) {
        const payload = JSON.stringify({
          observations: [
            {
              equipmentId,
              shelfId,
              quantityCalculated: 15,
            },
            {
              equipmentId,
              shelfId,
              quantityCalculated: 1,
              serialNumberCode: `SN-U${u}-SER`,
            },
          ],
        });
        subMap.set(ctrl.controllerId, parseCountSubmission(payload, ctrl.controllerId, ctrl.userId, new Date()));
      }
      unitSubmissions.set(unitId, subMap);
    }

    // Warm-up run
    compareInventoryRound(units, controllers, unitSubmissions);

    // Timed runs
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = compareInventoryRound(units, controllers, unitSubmissions);
      expect(res.status).toBe('CONVERGED');
      expect(res.isUnanimous).toBe(true);
      timings.push(performance.now() - start);
    }

    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    console.log(
      `[Large Dataset (1000 units x 10 controllers = 10,000 attempts)] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms across ${iterations} iterations`,
    );
    expect(p95).toBeLessThan(350);
  });

  it('benchmarks stock variance reconciliation on large dataset (1,000 units)', () => {
    const unitCount = 1000;
    const acceptedByUnit = new Map<string, NormalizedObservation[]>();
    const standardItems: FrozenBaselineSnapshot['standardItems'] = [];
    const serializedItems: FrozenBaselineSnapshot['serializedItems'] = [];

    for (let u = 0; u < unitCount; u++) {
      const unitId = `unit-${u}`;
      const equipmentId = `55555555-5555-4555-8555-${String(u).padStart(12, '0')}`;
      const shelfId = `66666666-6666-4666-8666-${String(u % 10).padStart(12, '0')}`;
      const serialCode = `SN-VAR-${u}`;

      acceptedByUnit.set(unitId, [
        {
          kind: 'STANDARD',
          equipmentId,
          shelfId,
          quantity: 15,
        },
        {
          kind: 'SERIALIZED',
          equipmentId,
          shelfId,
          quantity: 1,
          serialNumberCode: serialCode,
        },
      ]);

      standardItems.push({
        equipmentId,
        equipmentName: `Equipment ${u % 20}`,
        shelfId,
        shelfName: `Shelf ${u % 10}`,
        expectedQuantity: 15,
      });

      serializedItems.push({
        serialNumberId: `serial-id-${u}`,
        serialNumberCode: serialCode,
        equipmentId,
        equipmentName: `Equipment ${u % 20}`,
        expectedShelfId: shelfId,
        expectedShelfName: `Shelf ${u % 10}`,
      });
    }

    const baseline: FrozenBaselineSnapshot = {
      version: 1,
      frozenAt: new Date().toISOString(),
      typeInventory: 'ByEquipment',
      scope: {
        equipmentIds: standardItems.map((s) => s.equipmentId),
        shelfIds: standardItems.map((s) => s.shelfId),
      },
      standardItems,
      serializedItems,
    };

    const iterations = 20;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const variances = calculateStockVariances(acceptedByUnit, baseline);
      expect(variances.length).toBe(0); // All matched
      timings.push(performance.now() - start);
    }

    const p50 = percentile(timings, 50);
    const p95 = percentile(timings, 95);
    console.log(
      `[Baseline Variance Reconciliation (1,000 units)] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms across ${iterations} iterations`,
    );
    expect(p95).toBeLessThan(100);
  });
});
