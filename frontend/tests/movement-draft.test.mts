import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMovementPayload,
  createMovementDraft,
} from '../src/lib/movement-draft'

function standardEquipment(overrides: Record<string, unknown> = {}) {
  return {
    equipmentId: '11111111-1111-4111-8111-111111111111',
    equipmentName: 'Standard equipment',
    hasSerialNumber: false,
    equipmentQuantity: 10,
    minequipmentQuantity: 0,
    equipmentShelfs: [
      {
        equipmentShelfId: 'a',
        equipmentId: '11111111-1111-4111-8111-111111111111',
        shelfId: '22222222-2222-4222-8222-222222222222',
        equipmentQuantity: 10,
      },
    ],
    ...overrides,
  };
}

function serializedEquipment(overrides: Record<string, unknown> = {}) {
  return {
    equipmentId: '33333333-3333-4333-8333-333333333333',
    equipmentName: 'Serialized equipment',
    hasSerialNumber: true,
    equipmentQuantity: 2,
    minequipmentQuantity: 0,
    equipmentShelfs: [],
    ...overrides,
  };
}

test('builds one V3 IN document with multiple lines and one shared destination', () => {
  const standard = createMovementDraft(
    standardEquipment() as any,
  );
  standard.quantity = 5;

  const serialized = createMovementDraft(
    serializedEquipment() as any,
  );
  serialized.serialNumberIds = ['serial-a', 'serial-b'];

  const payload = buildMovementPayload({
    movementType: 'IN',
    destinationShelfId:
      '44444444-4444-4444-8444-444444444444',
    drafts: [standard, serialized],
  });

  assert.equal(payload.movementType, 'IN');
  assert.equal(payload.sourceShelfId, null);
  assert.equal(
    payload.destinationShelfId,
    '44444444-4444-4444-8444-444444444444',
  );
  assert.deepEqual(payload.items, [
    {
      equipmentId: standard.equipment.equipmentId,
      movementQuantity: 5,
    },
    {
      equipmentId: serialized.equipment.equipmentId,
      serialNumberId: 'serial-a',
      movementQuantity: 1,
    },
    {
      equipmentId: serialized.equipment.equipmentId,
      serialNumberId: 'serial-b',
      movementQuantity: 1,
    },
  ]);
});

test('TRANSFER validates the source allocation for standard equipment', () => {
  const draft = createMovementDraft(
    standardEquipment() as any,
  );
  draft.quantity = 4;

  const payload = buildMovementPayload({
    movementType: 'TRANSFER',
    sourceShelfId:
      '22222222-2222-4222-8222-222222222222',
    destinationShelfId:
      '55555555-5555-4555-8555-555555555555',
    drafts: [draft],
  });

  assert.equal(payload.items[0].movementQuantity, 4);
});

test('rejects insufficient standard stock at the shared source', () => {
  const draft = createMovementDraft(
    standardEquipment() as any,
  );
  draft.quantity = 11;

  assert.throws(
    () =>
      buildMovementPayload({
        movementType: 'OUT',
        sourceShelfId:
          '22222222-2222-4222-8222-222222222222',
        drafts: [draft],
      }),
    /stock insuffisant/i,
  );
});

test('rejects an invalid route for IN', () => {
  const draft = createMovementDraft(
    standardEquipment() as any,
  );

  assert.throws(
    () =>
      buildMovementPayload({
        movementType: 'IN',
        sourceShelfId:
          '22222222-2222-4222-8222-222222222222',
        destinationShelfId:
          '55555555-5555-4555-8555-555555555555',
        drafts: [draft],
      }),
    /ne doit pas avoir d’emplacement source/i,
  );
});

test('rejects more than 100 child lines', () => {
  const draft = createMovementDraft(
    serializedEquipment() as any,
  );

  draft.serialNumberIds = Array.from(
    { length: 101 },
    (_, index) => `serial-${index}`,
  );

  assert.throws(
    () =>
      buildMovementPayload({
        movementType: 'IN',
        destinationShelfId:
          '55555555-5555-4555-8555-555555555555',
        drafts: [draft],
      }),
    /100 lignes/i,
  );
});
