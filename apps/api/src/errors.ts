/** Expected failures have a stable wire code and a safe, user-facing message. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 422,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    Error.captureStackTrace(this, new.target);
  }
}

export class MealSlotOccupiedError extends AppError {
  constructor() {
    super(
      "MEAL_SLOT_OCCUPIED",
      "This slot already has a meal. Choose another slot.",
      409,
    );
  }
}
export class ListAccessError extends AppError {
  constructor() {
    super("LIST_ACCESS_DENIED", "You no longer have access to this list.", 403);
  }
}
export class VariantNotFoundError extends AppError {
  constructor() {
    super("VARIANT_NOT_FOUND", "This recipe is no longer available.", 404);
  }
}
