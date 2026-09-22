# SOMIPHARM final end-to-end checklist

Use this after TypeScript/build/tests pass.

## 1. Stock

- Create `ACTIVE` stock.
- Create `INACTIVE` stock.
- Confirm only `ACTIVE / INACTIVE` are visible.
- Confirm no archive action/status.
- Confirm no UUID/GUID is displayed or copied.
- Confirm inactive stock cannot receive a new shelf.

## 2. Shelf

- Create Shelf A in active stock.
- Create Shelf B in active stock.
- Open Shelf A.
- Empty shelf must show exactly:
  `Aucun article dans cet emplacement.`
- Confirm shelf detail has no Modify/Delete buttons.
- Confirm serialized equipment is expandable and serial identities appear below the equipment parent.

## 3. Equipment

- Create Standard equipment.
- Confirm physical quantity starts at 0.
- Create Serialized equipment.
- Manually enter a serial code.
- Confirm serial code is not generated automatically.
- Edit Equipment status ACTIVE/INACTIVE.
- Confirm equipment row has no Movement action.
- Open "Voir":
  - movement history visible;
  - serial list visible for serialized equipment;
  - no shelf/allocation section.

## 4. Standard -> Serialized conversion

- Choose a Standard equipment.
- Verify Standard -> Serialized is offered.
- Verify Serialized -> Standard is not offered.
- If physical quantity > 0, enter one serial code for every physical unit while preserving its existing shelf.
- Confirm conversion rejects incomplete/duplicate mapping.

## 5. Serial identity

- Create code manually.
- Confirm code is immutable afterwards.
- Confirm status remains editable.
- Confirm creating/deleting an unused serial identity does not directly edit physical quantity.

## 6. Movement

Open `/movements`.

### IN
- Source is not shown/required.
- Destination is an ACTIVE-stock shelf.
- Standard quantity increases.
- Serialized unit is assigned to destination shelf.

### TRANSFER
- Source list contains only real current allocations.
- For standard equipment, source must have enough quantity.
- For serialized equipment, source is the serial's actual shelf.
- Destination excludes source.
- Destination UI excludes an existing allocation of the selected equipment.
- Global physical quantity does not change.

### OUT
- Source is required.
- Standard global quantity decreases.
- Serialized serial leaves the shelf.

### Negative checks
- IN with source -> rejected.
- OUT without source -> rejected.
- TRANSFER source = destination -> rejected.
- quantity > source allocation -> rejected.
- inactive equipment/stock -> rejected.
- active inventory conflict -> rejected.

## 7. Inventory PRIMARY_MATCH

Create one-unit inventory with three distinct controllers.

1. Launch.
2. C1 submits unit result.
3. C2 submits same result.
4. Immediately verify:
   - unit = `PRIMARY_MATCH`;
   - accepted result = C1;
   - C3 has no task;
   - inventory can progress/complete when all units reconcile.

## 8. Inventory THIRD_REQUIRED

Create one-unit inventory.

1. C1 submits result A.
2. C2 submits a different result B.
3. Immediately verify:
   - only that unit = `THIRD_REQUIRED`;
   - C3 gets a task for that unit;
   - there is no global C3 recount.
4. C3 submits result C.
5. Verify:
   - unit = `THIRD_RESOLVED`;
   - accepted result = C3.

## 9. Multi-unit inventory concurrency

Create an inventory with at least 3 work units.

- C1 can continue U2/U3 while C2/C3 work on earlier units.
- C2 can continue according to the pipeline.
- A mismatch on U1 must not force C3 to recount U2/U3.
- Inventory becomes complete only after every unit has accepted reconciliation.

## 10. Report

For each work unit verify columns:

`C1 | C2 | C3 | Accepted | C1 vs Final | C2 vs Final`

Verify statuses where applicable:

- `CONFORME`
- `MANQUE`
- `SURPLUS`
- `MAUVAISE_POSITION`
- `MAUVAIS_ARTICLE`
- `PENDING`

## 11. Finalization

- Finalize only when all work units are reconciled.
- Finalization appends `INVENTORY_ADJUSTMENT` movements.
- Old movement history must not be modified.
- Adjustment movement should contain inventory metadata/reason.
- Physical stock after adjustment must match accepted inventory truth.

## 12. Final UI sweep

Across Stock, Shelf, Equipment, Movement and Inventory:

- no visible UUID/GUID;
- no GUID copy button;
- no UUID-based search input;
- no old global third-count/adjudication controls;
- Movement is top-level navigation;
- `/movements` does not redirect to Equipment.
