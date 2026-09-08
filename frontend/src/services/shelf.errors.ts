/**
 * Custom exceptions for Shelf operations and permission enforcement.
 */

export class ShelfServiceException extends Error {
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ShelfServiceException';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown whenever a user attempts an action (e.g. createShelf) without the requisite permission.
 */
export class InsufficientPermissionException extends ShelfServiceException {
  public readonly requiredPermission: string;

  constructor(
    requiredPermission: string = 'shelf.create',
    message?: string,
  ) {
    const defaultMsg = `Permission refusée : Vous n'avez pas la permission requise ('${requiredPermission}') pour effectuer cette opération.`;
    super(message || defaultMsg, 403);
    this.name = 'InsufficientPermissionException';
    this.requiredPermission = requiredPermission;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when client or server validation fails for Shelf payload.
 */
export class ShelfValidationException extends ShelfServiceException {
  public readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string = 'Données d’étagère non valides',
    validationErrors?: Record<string, string[]>,
  ) {
    super(message, 400, validationErrors);
    this.name = 'ShelfValidationException';
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
