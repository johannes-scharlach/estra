import { assertEquals } from 'jsr:@std/assert@^1';
import { decidePushFailure, decidePushResult, decideReceiptResult } from './notification-policy.ts';

const now = new Date('2026-09-29T12:00:00.000Z');

Deno.test('an accepted ticket waits fifteen minutes for its receipt', () => {
  assertEquals(decidePushResult({ status: 'ok', id: 'ticket-1' }, 1, now), {
    type: 'ticketed',
    ticketId: 'ticket-1',
    receiptDueAt: '2026-09-29T12:15:00.000Z',
  });
});

Deno.test('transient push failures back off and eventually stop', () => {
  assertEquals(decidePushFailure('network_error', 1, now), {
    type: 'retry-push',
    nextAttemptAt: '2026-09-29T12:01:00.000Z',
    error: 'network_error',
  });
  assertEquals(decidePushFailure('network_error', 6, now), {
    type: 'failed',
    error: 'retry_exhausted:network_error',
    disableDevice: false,
  });
});

Deno.test('an unregistered device is disabled without retry', () => {
  assertEquals(
    decideReceiptResult(
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      now,
      now,
    ),
    { type: 'failed', error: 'DeviceNotRegistered', disableDevice: true },
  );
});

Deno.test('missing receipts are checked again but expire before Expo deletes them', () => {
  assertEquals(decideReceiptResult(undefined, now, new Date('2026-09-29T12:15:00Z')), {
    type: 'retry-receipt',
    receiptDueAt: '2026-09-29T12:30:00.000Z',
    error: 'receipt_not_ready',
  });
  assertEquals(decideReceiptResult(undefined, now, new Date('2026-09-30T11:00:00Z')), {
    type: 'failed',
    error: 'receipt_expired',
    disableDevice: false,
  });
});
