import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateMovementAudit,
  flattenMovementLines,
} from '../src/lib/movement-ledger';

const equipmentId =
  '11111111-1111-4111-8111-111111111111';

function movement(
  id: string,
  status: string,
  quantity: number,
  sourceShelfId: string | null,
  destinationShelfId: string | null,
) {
  return {
    mouvementId: id,
    createdAt: `2026-09-21T10:0${id}:00.000Z`,
    mouvementStatus: status,
    mouvementQuantity: quantity,
    equipmentId,
    serialNumberId: null,
    sourceShelfId,
    destinationShelfId,
    items: [
      {
        mouvementEquipmentId: `line-${id}`,
        mouvementId: id,
        equipmentId,
        serialNumberId: null,
        sourceShelfId,
        destinationShelfId,
        mouvementQuantity: quantity,
        mouvementStatus: status,
      },
    ],
  };
}

test('flattens V3 movement headers into equipment lines', () => {
  const rows = flattenMovementLines(
    [
      movement('1', 'IN', 10, null, 'shelf-a'),
      movement('2', 'TRANSFER', 4, 'shelf-a', 'shelf-b'),
    ] as any,
    equipmentId,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].mouvementEquipmentId, 'line-1');
  assert.equal(rows[1].mouvementEquipmentId, 'line-2');
});

test('standard stock audit ignores TRANSFER in global quantity', () => {
  const summary = calculateMovementAudit(
    [
      movement('1', 'IN', 10, null, 'shelf-a'),
      movement('2', 'TRANSFER', 4, 'shelf-a', 'shelf-b'),
      movement('3', 'OUT', 2, 'shelf-b', null),
    ] as any,
    8,
    equipmentId,
  );

  assert.equal(summary.initialQuantity, 0);
  assert.equal(summary.totalIn, 10);
  assert.equal(summary.totalOut, 2);
  assert.equal(summary.currentQuantity, 8);

  assert.deepEqual(
    summary.ledger.map((entry: any) => entry.delta),
    [10, 0, -2],
  );

  assert.deepEqual(
    summary.ledger.map((entry: any) => entry.runningBalance),
    [10, 10, 8],
  );
});

test('reads historical ENTRY/EXIT aliases without creating them', () => {
  const summary = calculateMovementAudit(
    [
      movement('1', 'ENTRY', 3, null, 'shelf-a'),
      movement('2', 'EXIT', 1, 'shelf-a', null),
    ] as any,
    2,
    equipmentId,
  );

  assert.equal(summary.totalIn, 3);
  assert.equal(summary.totalOut, 1);
});
