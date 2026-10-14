/**
 * Authoritative Normalization & Comparison Engine for Inventory Redesign
 *
 * Implements pure, deterministic normalization, validation, and multi-controller
 * comparison according to the specification:
 * - Minimum 3 controllers, no fixed ceiling (supports 3, 4, 5, 10+).
 * - Equal counters: unanimity across ALL assigned controllers is required.
 * - Standard equipment compared per (equipmentId, shelfId).
 * - Serialized equipment compared by exact serial code, equipment identity, and observed location.
 * - Nonnegative integer quantities, serialized quantity of 1.
 * - Detection of duplicate scans within a controller submission or across units.
 * - Distinguishes unsubmitted (PENDING), explicit zero/empty, and malformed data.
 * - Distinguishes controller disagreements (RECOUNT) from book baseline variance (STOCK_VARIANCE).
 */

export interface NormalizedObservation {
  kind: 'STANDARD' | 'SERIALIZED';
  equipmentId: string;
  shelfId: string;
  quantity: number;
  serialNumberCode?: string | null;
  serialNumberId?: string | null;
  isUnexpected?: boolean;
  isExplicitZero?: boolean;
  notes?: string | null;
}

export interface ParsedSubmission {
  controllerId: string;
  userId: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  isDraft: boolean;
  isExplicitEmpty: boolean;
  notes?: string | null;
  observations: NormalizedObservation[];
  validationErrors: string[];
  /** Keyed by canonical item key */
  standardMap: Map<string, number>; // key: equipmentId|shelfId -> quantity
  serialMap: Map<string, { equipmentId: string; shelfId: string; serialNumberId?: string | null }>; // key: serialCode -> location
  duplicatesDetected: string[];
}

export interface BaselineStandardItem {
  equipmentId: string;
  equipmentName?: string;
  shelfId: string;
  shelfName?: string;
  expectedQuantity: number;
}

export interface BaselineSerializedItem {
  serialNumberId: string;
  serialNumberCode: string;
  equipmentId: string;
  equipmentName?: string;
  expectedShelfId: string | null;
  expectedShelfName?: string | null;
}

export interface FrozenBaselineSnapshot {
  version: number;
  frozenAt: string;
  typeInventory: 'ByEquipment' | 'ByShelf';
  scope: {
    equipmentIds: string[];
    shelfIds: string[];
  };
  standardItems: BaselineStandardItem[];
  serializedItems: BaselineSerializedItem[];
}

export interface ControllerInfo {
  controllerId: string;
  userId: string;
  sequence: number; // 0-indexed display sequence
  round: number; // 1-indexed controller ordering
  userName?: string | null;
  userEmail?: string | null;
}

export interface UnitDisagreement {
  unitId: string;
  reason: string;
  itemKey: string;
  controllerCounts: Record<string, number | string | null>;
}

export interface StockVarianceIssueData {
  unitId?: string | null;
  equipmentId?: string | null;
  shelfId?: string | null;
  serialNumberCode?: string | null;
  serialNumberId?: string | null;
  expectedQuantity: number;
  observedQuantity: number;
  deltaQuantity: number;
  expectedShelfId?: string | null;
  observedShelfId?: string | null;
  varianceType: 'SHORTAGE' | 'SURPLUS' | 'LOCATION_MISMATCH' | 'UNEXPECTED_SERIAL';
}

export interface UnitComparisonResult {
  unitId: string;
  isComplete: boolean;
  isMatch: boolean;
  status: 'PENDING' | 'CONVERGED' | 'RECOUNT_REQUIRED';
  disagreements: UnitDisagreement[];
  acceptedObservations?: NormalizedObservation[];
  validationErrors: string[];
}

export interface RoundComparisonResult {
  isComplete: boolean; // all controllers submitted all units
  isUnanimous: boolean; // all controllers agreed on all units with no blockers
  status: 'IN_PROGRESS' | 'CONVERGED' | 'RECOUNT_REQUIRED';
  totalUnits: number;
  submittedUnitsCount: number;
  unitResults: Map<string, UnitComparisonResult>;
  allDisagreements: UnitDisagreement[];
  stockVariances: StockVarianceIssueData[];
  acceptedObservationsByUnit: Map<string, NormalizedObservation[]>;
}

export interface ComparisonReportCell {
  quantity: number;
  serialNumberCode: string | null;
  shelfId: string | null;
  isSubmitted: boolean;
  isExplicitZero: boolean;
}

export interface DynamicReportRow {
  rowKey: string;
  kind: 'STANDARD' | 'SERIALIZED';
  equipmentId: string;
  shelfId: string;
  serialNumberCode?: string | null;
  baselineQuantity: number;
  controllers: Record<string, ComparisonReportCell>; // keyed by controllerId or sequence
  agreedQuantity: number | null;
  status: 'CONFORME' | 'MANQUE' | 'SURPLUS' | 'DISAGREEMENT' | 'PENDING' | 'MAUVAISE_POSITION' | 'UNEXPECTED';
  deltaFromBaseline: number | null;
}

/**
 * Normalizes UUID to trimmed lowercase format.
 */
export function normalizeUuid(val: string | null | undefined): string {
  if (!val) return '';
  return val.trim().toLowerCase();
}

/**
 * Preserves serial code casing while trimming leading/trailing whitespace.
 */
export function normalizeSerialCode(code: string | null | undefined): string {
  if (!code) return '';
  return code.trim();
}

/**
 * Parses and strictly validates a raw resultData JSON payload submitted by a controller.
 */
export function parseCountSubmission(
  rawJson: string | null | undefined,
  controllerId: string,
  userId: string,
  submittedAt?: Date | string | null,
): ParsedSubmission {
  const result: ParsedSubmission = {
    controllerId,
    userId,
    isSubmitted: Boolean(submittedAt),
    submittedAt: submittedAt ? new Date(submittedAt).toISOString() : null,
    isDraft: false,
    isExplicitEmpty: false,
    notes: null,
    observations: [],
    validationErrors: [],
    standardMap: new Map(),
    serialMap: new Map(),
    duplicatesDetected: [],
  };

  if (!rawJson) {
    return result;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    result.validationErrors.push(`Format JSON invalide: ${err?.message || 'parse error'}`);
    return result;
  }

  result.isDraft = Boolean(parsed.isDraft);
  result.isExplicitEmpty = Boolean(parsed.isExplicitEmpty || parsed.isExplicitZero);
  result.notes = typeof parsed.notes === 'string' ? parsed.notes : null;

  const rawList: any[] = Array.isArray(parsed.observations)
    ? parsed.observations
    : Array.isArray(parsed.orders)
      ? parsed.orders
      : Array.isArray(parsed)
        ? parsed
        : [];

  const seenSerials = new Set<string>();

  for (let idx = 0; idx < rawList.length; idx++) {
    const item = rawList[idx];
    if (!item || typeof item !== 'object') {
      result.validationErrors.push(`Observation #${idx} invalide`);
      continue;
    }

    const serialCode = normalizeSerialCode(
      item.scannedSerialCode || item.serialNumberCode || item.serialNumber?.serialNumberCode,
    );
    const equipmentId = normalizeUuid(item.observedEquipmentId || item.equipmentId);
    const shelfId = normalizeUuid(item.observedShelfId || item.shelfId);
    const serialNumberId = normalizeUuid(item.serialNumberId || item.serialNumber?.serialNumberId);
    const isExplicitZero = Boolean(item.isExplicitZero);
    const isUnexpected = Boolean(item.isUnexpected);
    const notes = typeof item.notes === 'string' ? item.notes : null;

    if (serialCode) {
      // Serialized observation
      if (seenSerials.has(serialCode.toLowerCase())) {
        const error = `Numéro de série en double détecté dans la même soumission: ${serialCode}`;
        result.validationErrors.push(error);
        result.duplicatesDetected.push(serialCode);
      }
      seenSerials.add(serialCode.toLowerCase());

      const qty = item.quantityCalculated !== undefined ? Number(item.quantityCalculated) : 1;
      if (qty !== 1 && !isExplicitZero) {
        result.validationErrors.push(
          `La quantité pour un équipement avec numéro de série (${serialCode}) doit être égale à 1 (reçu: ${qty})`,
        );
      }

      if (!isExplicitZero) {
        result.serialMap.set(serialCode.toLowerCase(), {
          equipmentId,
          shelfId,
          serialNumberId: serialNumberId || null,
        });
      }

      result.observations.push({
        kind: 'SERIALIZED',
        equipmentId,
        shelfId,
        quantity: isExplicitZero ? 0 : 1,
        serialNumberCode: serialCode,
        serialNumberId: serialNumberId || null,
        isUnexpected,
        isExplicitZero,
        notes,
      });
    } else if (equipmentId || shelfId) {
      // Standard observation
      const rawQty = item.quantityCalculated ?? item.equipmentQuantity ?? 0;
      const qty = Number(rawQty);

      if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0) {
        result.validationErrors.push(
          `Quantité invalide pour article ${equipmentId}: ${rawQty} (doit être un entier positif ou nul)`,
        );
      }

      if (qty > 2_147_483_647) {
        result.validationErrors.push(`Quantité hors limite permise: ${qty}`);
      }

      const key = `${equipmentId}|${shelfId}`;
      const current = result.standardMap.get(key) ?? 0;
      result.standardMap.set(key, current + (isExplicitZero ? 0 : Math.max(0, qty)));

      result.observations.push({
        kind: 'STANDARD',
        equipmentId,
        shelfId,
        quantity: isExplicitZero ? 0 : Math.max(0, qty),
        serialNumberCode: null,
        serialNumberId: null,
        isUnexpected,
        isExplicitZero,
        notes,
      });
    }
  }

  return result;
}

/**
 * Pure comparison function for standard equipment observation maps.
 * Compares two maps keyed by `${equipmentId}|${shelfId}`.
 */
export function areStandardMapsEqual(
  a: Map<string, number>,
  b: Map<string, number>,
): { isEqual: boolean; differences: string[] } {
  const differences: string[] = [];
  const allKeys = new Set([...a.keys(), ...b.keys()]);

  for (const key of allKeys) {
    const qtyA = a.get(key) ?? 0;
    const qtyB = b.get(key) ?? 0;
    if (qtyA !== qtyB) {
      differences.push(`Article/emplacement ${key}: quantité A=${qtyA} vs B=${qtyB}`);
    }
  }

  return {
    isEqual: differences.length === 0,
    differences,
  };
}

/**
 * Pure comparison function for serialized equipment maps.
 * Compares two maps keyed by serial code (lowercase) to location object.
 */
export function areSerialMapsEqual(
  a: Map<string, { equipmentId: string; shelfId: string }>,
  b: Map<string, { equipmentId: string; shelfId: string }>,
): { isEqual: boolean; differences: string[] } {
  const differences: string[] = [];
  const allSerials = new Set([...a.keys(), ...b.keys()]);

  for (const serial of allSerials) {
    const itemA = a.get(serial);
    const itemB = b.get(serial);

    if (!itemA && itemB) {
      differences.push(`Numéro de série ${serial} présent dans B mais absent de A`);
    } else if (itemA && !itemB) {
      differences.push(`Numéro de série ${serial} présent dans A mais absent de B`);
    } else if (itemA && itemB) {
      if (itemA.shelfId !== itemB.shelfId) {
        differences.push(
          `Numéro de série ${serial}: emplacement divergent (A: ${itemA.shelfId} vs B: ${itemB.shelfId})`,
        );
      }
      if (itemA.equipmentId && itemB.equipmentId && itemA.equipmentId !== itemB.equipmentId) {
        differences.push(
          `Numéro de série ${serial}: article divergent (A: ${itemA.equipmentId} vs B: ${itemB.equipmentId})`,
        );
      }
    }
  }

  return {
    isEqual: differences.length === 0,
    differences,
  };
}

/**
 * Compares all N controller submissions for a SINGLE work unit.
 * Requires unanimity across all N controllers.
 */
export function compareUnitSubmissions(
  unitId: string,
  controllers: ControllerInfo[],
  submissions: Map<string, ParsedSubmission>, // keyed by controllerId
): UnitComparisonResult {
  const result: UnitComparisonResult = {
    unitId,
    isComplete: false,
    isMatch: false,
    status: 'PENDING',
    disagreements: [],
    validationErrors: [],
  };

  if (controllers.length < 3) {
    result.validationErrors.push('Au moins 3 contrôleurs sont requis');
    return result;
  }

  // Check if all controllers have submitted
  const activeSubmissions: ParsedSubmission[] = [];
  for (const c of controllers) {
    const sub = submissions.get(c.controllerId);
    if (!sub || !sub.isSubmitted) {
      result.status = 'PENDING';
      return result;
    }
    if (sub.validationErrors.length > 0) {
      result.validationErrors.push(...sub.validationErrors);
    }
    activeSubmissions.push(sub);
  }

  result.isComplete = true;

  // If there are validation errors (such as duplicate scans inside a submission), it's a blocker
  if (result.validationErrors.length > 0) {
    result.status = 'RECOUNT_REQUIRED';
    result.disagreements.push({
      unitId,
      reason: 'Erreurs de validation de comptage (ex: doublons internes)',
      itemKey: 'VALIDATION',
      controllerCounts: {},
    });
    return result;
  }

  // Compare all submissions against the reference (first controller)
  const ref = activeSubmissions[0];
  let allMatch = true;

  // Gather all item keys
  const allStandardKeys = new Set<string>();
  const allSerialKeys = new Set<string>();
  for (const sub of activeSubmissions) {
    for (const k of sub.standardMap.keys()) allStandardKeys.add(k);
    for (const k of sub.serialMap.keys()) allSerialKeys.add(k);
  }

  // Check standard item equality across all N controllers
  for (const key of allStandardKeys) {
    const countsPerController: Record<string, number> = {};
    const refCount = ref.standardMap.get(key) ?? 0;
    let keyAgrees = true;

    for (const sub of activeSubmissions) {
      const cnt = sub.standardMap.get(key) ?? 0;
      countsPerController[sub.controllerId] = cnt;
      if (cnt !== refCount) {
        keyAgrees = false;
      }
    }

    if (!keyAgrees) {
      allMatch = false;
      result.disagreements.push({
        unitId,
        reason: `Divergence de quantité pour l'article ${key}`,
        itemKey: `STD|${key}`,
        controllerCounts: countsPerController,
      });
    }
  }

  // Check serial equality across all N controllers
  for (const serial of allSerialKeys) {
    const locsPerController: Record<string, string | null> = {};
    const refLoc = ref.serialMap.get(serial)?.shelfId ?? null;
    let serialAgrees = true;

    for (const sub of activeSubmissions) {
      const loc = sub.serialMap.get(serial)?.shelfId ?? null;
      locsPerController[sub.controllerId] = loc;
      if (loc !== refLoc) {
        serialAgrees = false;
      }
    }

    if (!serialAgrees) {
      allMatch = false;
      result.disagreements.push({
        unitId,
        reason: `Divergence de présence ou d'emplacement pour le numéro de série ${serial}`,
        itemKey: `SER|${serial}`,
        controllerCounts: locsPerController,
      });
    }
  }

  if (allMatch) {
    result.isMatch = true;
    result.status = 'CONVERGED';
    result.acceptedObservations = ref.observations;
  } else {
    result.isMatch = false;
    result.status = 'RECOUNT_REQUIRED';
  }

  return result;
}

/**
 * Compares an entire inventory round across all units and all N controllers.
 */
export function compareInventoryRound(
  units: Array<{ unitId: string; equipmentId: string | null; shelfId: string | null }>,
  controllers: ControllerInfo[],
  unitSubmissions: Map<string, Map<string, ParsedSubmission>>, // unitId -> (controllerId -> ParsedSubmission)
  snapshotData?: FrozenBaselineSnapshot | null,
): RoundComparisonResult {
  const result: RoundComparisonResult = {
    isComplete: true,
    isUnanimous: true,
    status: 'CONVERGED',
    totalUnits: units.length,
    submittedUnitsCount: 0,
    unitResults: new Map(),
    allDisagreements: [],
    stockVariances: [],
    acceptedObservationsByUnit: new Map(),
  };

  if (units.length === 0 || controllers.length < 3) {
    result.isComplete = false;
    result.isUnanimous = false;
    result.status = 'IN_PROGRESS';
    return result;
  }

  // Detect if any controller scanned the same serial across DIFFERENT units in this round
  for (const c of controllers) {
    const serialLocationsSeen = new Map<string, { unitId: string; shelfId: string }>();
    for (const u of units) {
      const subs = unitSubmissions.get(u.unitId);
      const sub = subs?.get(c.controllerId);
      if (sub) {
        for (const [serial, loc] of sub.serialMap.entries()) {
          const prior = serialLocationsSeen.get(serial);
          if (prior && prior.unitId !== u.unitId) {
            result.allDisagreements.push({
              unitId: u.unitId,
              reason: `Contrôleur ${c.controllerId} a scanné le numéro de série ${serial} dans plusieurs unités différentes (${prior.unitId} et ${u.unitId})`,
              itemKey: `CROSS_UNIT_DUPLICATE|${serial}`,
              controllerCounts: { [c.controllerId]: `${prior.shelfId} -> ${loc.shelfId}` },
            });
            result.isUnanimous = false;
          } else {
            serialLocationsSeen.set(serial, { unitId: u.unitId, shelfId: loc.shelfId });
          }
        }
      }
    }
  }

  for (const unit of units) {
    const subsForUnit = unitSubmissions.get(unit.unitId) ?? new Map();
    const unitComparison = compareUnitSubmissions(unit.unitId, controllers, subsForUnit);

    result.unitResults.set(unit.unitId, unitComparison);

    if (unitComparison.isComplete) {
      result.submittedUnitsCount++;
    } else {
      result.isComplete = false;
    }

    if (!unitComparison.isMatch) {
      result.isUnanimous = false;
      result.allDisagreements.push(...unitComparison.disagreements);
    } else if (unitComparison.acceptedObservations) {
      result.acceptedObservationsByUnit.set(unit.unitId, unitComparison.acceptedObservations);
    }
  }

  if (!result.isComplete) {
    result.status = 'IN_PROGRESS';
    result.isUnanimous = false;
  } else if (!result.isUnanimous) {
    result.status = 'RECOUNT_REQUIRED';
  } else {
    result.status = 'CONVERGED';

    // If converged, compare physical truth against frozen baseline snapshot to detect stock variances
    if (snapshotData) {
      result.stockVariances = calculateStockVariances(result.acceptedObservationsByUnit, snapshotData);
    }
  }

  return result;
}

/**
 * Calculates stock variances (shortage, surplus, location mismatch, unexpected serial)
 * between the agreed physical observations and the frozen baseline snapshot.
 */
export function calculateStockVariances(
  acceptedByUnit: Map<string, NormalizedObservation[]>,
  baseline: FrozenBaselineSnapshot,
): StockVarianceIssueData[] {
  const issues: StockVarianceIssueData[] = [];

  // 1. Gather all accepted physical observations
  const physicalStandard = new Map<string, number>(); // eqId|shelfId -> qty
  const physicalSerials = new Map<string, { equipmentId: string; shelfId: string; serialNumberId?: string | null }>();

  for (const [unitId, obsList] of acceptedByUnit.entries()) {
    for (const obs of obsList) {
      if (obs.kind === 'SERIALIZED' && obs.serialNumberCode) {
        physicalSerials.set(obs.serialNumberCode.toLowerCase(), {
          equipmentId: obs.equipmentId,
          shelfId: obs.shelfId,
          serialNumberId: obs.serialNumberId,
        });
      } else if (obs.kind === 'STANDARD') {
        const key = `${obs.equipmentId}|${obs.shelfId}`;
        physicalStandard.set(key, (physicalStandard.get(key) ?? 0) + obs.quantity);
      }
    }
  }

  // 2. Check Standard items against baseline
  const baselineStandardMap = new Map<string, { expectedQuantity: number; equipmentId: string; shelfId: string }>();
  for (const item of baseline.standardItems) {
    const key = `${normalizeUuid(item.equipmentId)}|${normalizeUuid(item.shelfId)}`;
    baselineStandardMap.set(key, {
      expectedQuantity: item.expectedQuantity,
      equipmentId: normalizeUuid(item.equipmentId),
      shelfId: normalizeUuid(item.shelfId),
    });
  }

  const allStandardKeys = new Set([...baselineStandardMap.keys(), ...physicalStandard.keys()]);
  for (const key of allStandardKeys) {
    const expected = baselineStandardMap.get(key)?.expectedQuantity ?? 0;
    const observed = physicalStandard.get(key) ?? 0;
    const delta = observed - expected;

    if (delta !== 0) {
      const [equipmentId, shelfId] = key.split('|');
      issues.push({
        equipmentId,
        shelfId,
        expectedQuantity: expected,
        observedQuantity: observed,
        deltaQuantity: delta,
        varianceType: delta < 0 ? 'SHORTAGE' : 'SURPLUS',
      });
    }
  }

  // 3. Check Serialized items against baseline
  const baselineSerialMap = new Map<string, BaselineSerializedItem>();
  for (const item of baseline.serializedItems) {
    baselineSerialMap.set(item.serialNumberCode.toLowerCase(), item);
  }

  const allSerialCodes = new Set([...baselineSerialMap.keys(), ...physicalSerials.keys()]);
  for (const code of allSerialCodes) {
    const baseItem = baselineSerialMap.get(code);
    const physItem = physicalSerials.get(code);

    if (baseItem && !physItem) {
      // Shortage / Missing serial
      issues.push({
        equipmentId: baseItem.equipmentId,
        shelfId: baseItem.expectedShelfId,
        serialNumberCode: baseItem.serialNumberCode,
        serialNumberId: baseItem.serialNumberId,
        expectedQuantity: 1,
        observedQuantity: 0,
        deltaQuantity: -1,
        varianceType: 'SHORTAGE',
      });
    } else if (!baseItem && physItem) {
      // Unexpected / Surplus serial found in stock
      issues.push({
        equipmentId: physItem.equipmentId,
        shelfId: physItem.shelfId,
        serialNumberCode: code,
        serialNumberId: physItem.serialNumberId,
        expectedQuantity: 0,
        observedQuantity: 1,
        deltaQuantity: 1,
        varianceType: 'UNEXPECTED_SERIAL',
      });
    } else if (baseItem && physItem) {
      // Both exist: check location
      const baseShelf = normalizeUuid(baseItem.expectedShelfId);
      const physShelf = normalizeUuid(physItem.shelfId);
      if (baseShelf && physShelf && baseShelf !== physShelf) {
        issues.push({
          equipmentId: baseItem.equipmentId,
          expectedShelfId: baseItem.expectedShelfId,
          observedShelfId: physItem.shelfId,
          serialNumberCode: baseItem.serialNumberCode,
          serialNumberId: baseItem.serialNumberId,
          expectedQuantity: 1,
          observedQuantity: 1,
          deltaQuantity: 0,
          varianceType: 'LOCATION_MISMATCH',
        });
      }
    }
  }

  return issues;
}
