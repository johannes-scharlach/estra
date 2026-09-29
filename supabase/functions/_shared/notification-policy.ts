export const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_EXPIRY_MS = 23 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 4 * 60 * 60_000];

export type ExpoResult =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export type DeliveryDecision =
  | { type: 'ticketed'; ticketId: string; receiptDueAt: string }
  | { type: 'delivered' }
  | { type: 'retry-push'; nextAttemptAt: string; error: string }
  | { type: 'retry-receipt'; receiptDueAt: string; error: string }
  | { type: 'failed'; error: string; disableDevice: boolean };

export function decidePushResult(
  result: ExpoResult,
  attemptsCompleted: number,
  now: Date,
): DeliveryDecision {
  if (result.status === 'ok' && result.id) {
    return {
      type: 'ticketed',
      ticketId: result.id,
      receiptDueAt: later(now, RECEIPT_DELAY_MS),
    };
  }
  const error = expoError(result) ?? 'invalid_expo_ticket';
  return decidePushFailure(error, attemptsCompleted, now);
}

export function decidePushFailure(
  error: string,
  attemptsCompleted: number,
  now: Date,
): DeliveryDecision {
  if (error === 'DeviceNotRegistered') {
    return { type: 'failed', error, disableDevice: true };
  }
  if (['MessageTooBig', 'MismatchSenderId', 'InvalidCredentials'].includes(error)) {
    return { type: 'failed', error, disableDevice: false };
  }
  const delay = RETRY_DELAYS_MS[attemptsCompleted - 1];
  return delay === undefined
    ? { type: 'failed', error: `retry_exhausted:${error}`, disableDevice: false }
    : { type: 'retry-push', nextAttemptAt: later(now, delay), error };
}

export function decideReceiptResult(
  result: ExpoResult | undefined,
  ticketSentAt: Date,
  now: Date,
): DeliveryDecision {
  if (!result) {
    return now.getTime() - ticketSentAt.getTime() >= RECEIPT_EXPIRY_MS
      ? { type: 'failed', error: 'receipt_expired', disableDevice: false }
      : {
        type: 'retry-receipt',
        receiptDueAt: later(now, RECEIPT_DELAY_MS),
        error: 'receipt_not_ready',
      };
  }
  if (result.status === 'ok') return { type: 'delivered' };
  const error = expoError(result) ?? 'invalid_expo_receipt';
  if (error === 'MessageRateExceeded') {
    return { type: 'retry-push', nextAttemptAt: later(now, 5 * 60_000), error };
  }
  if (error === 'DeviceNotRegistered') {
    return { type: 'failed', error, disableDevice: true };
  }
  return { type: 'failed', error, disableDevice: false };
}

function expoError(result: ExpoResult): string | undefined {
  return result.status === 'error' ? result.details?.error ?? result.message : undefined;
}

function later(now: Date, milliseconds: number): string {
  return new Date(now.getTime() + milliseconds).toISOString();
}
