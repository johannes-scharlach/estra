export class ImportFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ImportFailure";
  }
}

export function importFailure(error: unknown): ImportFailure {
  return error instanceof ImportFailure
    ? error
    : new ImportFailure(
        "UNEXPECTED_ERROR",
        "Something went wrong. Please try again.",
        true,
        { cause: error },
      );
}
