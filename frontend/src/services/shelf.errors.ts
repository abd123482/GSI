export class ShelfServiceException extends Error {
  constructor(message: string, public status?: number, public data?: any) {
    super(message);
    this.name = 'ShelfServiceException';
  }
}

export class InsufficientPermissionException extends Error {
  constructor(public permission: string, message: string) {
    super(message);
    this.name = 'InsufficientPermissionException';
  }
}

export class ShelfValidationException extends Error {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ShelfValidationException';
  }
}
