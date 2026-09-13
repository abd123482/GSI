/**
 * System-wide permission registry for SomePharm Maintenance RBAC.
 */
export const ALL_SYSTEM_PERMISSIONS = [
  'equipment.read',
  'equipment.create',
  'equipment.update',
  'equipment.delete',
  'serial-number.read',
  'serial-number.create',
  'serial-number.update',
  'serial-number.delete',
  'movement.read',
  'movement.create',
  'shelf.read',
  'shelf.create',
  'shelf.update',
  'shelf.delete',
  'stock.read',
  'stock.create',
  'stock.update',
  'stock.delete',
  'user.manage',
  'role.manage',
] as const;

export type SystemPermission = (typeof ALL_SYSTEM_PERMISSIONS)[number];
