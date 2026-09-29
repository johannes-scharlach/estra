import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decidePushFailure,
  decidePushResult,
  decideReceiptResult,
  type DeliveryDecision,
  type ExpoResult,
} from './notification-policy.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

type ClaimedDelivery = {
  id: string;
  activity_id: string;
  list_id: string;
  user_id: string;
  device_id: string;
  expo_push_token: string;
  status: 'pending' | 'retry' | 'ticketed';
  attempt_count: number;
  expo_ticket_id: string | null;
  ticket_sent_at: string | null;
  actor_name: string;
  household_name: string;
};

export async function dispatchNotificationBatch(
  supabase: SupabaseClient,
  maxBatches = 1,
): Promise<number> {
  let processed = 0;
  // Bound one invocation while still draining normal bursts larger than one
  // Expo request. Cron recovery continues from the same durable queue.
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const claimId = crypto.randomUUID();
    const { data, error } = await supabase.rpc('claim_notification_deliveries', {
      claim_id: claimId,
      batch_size: 100,
      lease_seconds: 60,
    });
    if (error) throw error;
    const claimed = (data ?? []) as ClaimedDelivery[];
    if (!claimed.length) break;
    const pushes = claimed.filter((delivery) => delivery.status !== 'ticketed');
    const receipts = claimed.filter((delivery) => delivery.status === 'ticketed');
    await Promise.all([
      sendPushes(supabase, pushes, claimId),
      checkReceipts(supabase, receipts, claimId),
    ]);
    processed += claimed.length;
  }
  return processed;
}

async function sendPushes(
  supabase: SupabaseClient,
  deliveries: ClaimedDelivery[],
  claimId: string,
) {
  if (!deliveries.length) return;
  const now = new Date();
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: expoHeaders(),
      body: JSON.stringify(deliveries.map(pushMessage)),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`expo_http_${response.status}`);
    const body = await response.json() as { data?: ExpoResult[] };
    if (!Array.isArray(body.data) || body.data.length !== deliveries.length) {
      throw new Error('invalid_expo_ticket_response');
    }
    await Promise.all(deliveries.map((delivery, index) =>
      applyDecision(
        supabase,
        delivery,
        claimId,
        decidePushResult(body.data![index]!, delivery.attempt_count + 1, now),
        true,
      )
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'expo_request_failed';
    await Promise.all(deliveries.map((delivery) =>
      applyDecision(
        supabase,
        delivery,
        claimId,
        decidePushFailure(message, delivery.attempt_count + 1, now),
        true,
      )
    ));
  }
}

async function checkReceipts(
  supabase: SupabaseClient,
  deliveries: ClaimedDelivery[],
  claimId: string,
) {
  if (!deliveries.length) return;
  const now = new Date();
  const ids = deliveries.map((delivery) => delivery.expo_ticket_id).filter(Boolean) as string[];
  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: expoHeaders(),
      body: JSON.stringify({ ids }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`expo_receipt_http_${response.status}`);
    const body = await response.json() as { data?: Record<string, ExpoResult> };
    if (!body.data || typeof body.data !== 'object') {
      throw new Error('invalid_expo_receipt_response');
    }
    await Promise.all(deliveries.map((delivery) =>
      applyDecision(
        supabase,
        delivery,
        claimId,
        decideReceiptResult(
          body.data![delivery.expo_ticket_id!],
          new Date(delivery.ticket_sent_at!),
          now,
        ),
        false,
      )
    ));
  } catch (error) {
    await Promise.all(deliveries.map((delivery) =>
      applyDecision(
        supabase,
        delivery,
        claimId,
        decideReceiptResult(undefined, new Date(delivery.ticket_sent_at!), now),
        false,
      )
    ));
    console.error('Expo receipt request failed', error);
  }
}

async function applyDecision(
  supabase: SupabaseClient,
  delivery: ClaimedDelivery,
  claimId: string,
  decision: DeliveryDecision,
  attemptedPush: boolean,
) {
  const common = {
    lease_id: null,
    lease_until: null,
    updated_at: new Date().toISOString(),
    ...(attemptedPush ? { attempt_count: delivery.attempt_count + 1 } : {}),
  };
  const changes = decision.type === 'ticketed'
    ? {
      ...common,
      status: 'ticketed',
      expo_ticket_id: decision.ticketId,
      ticket_sent_at: new Date().toISOString(),
      receipt_due_at: decision.receiptDueAt,
      last_error: null,
    }
    : decision.type === 'delivered'
    ? {
      ...common,
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      last_error: null,
    }
    : decision.type === 'retry-push'
    ? {
      ...common,
      status: 'retry',
      next_attempt_at: decision.nextAttemptAt,
      expo_ticket_id: null,
      ticket_sent_at: null,
      receipt_due_at: null,
      last_error: decision.error,
    }
    : decision.type === 'retry-receipt'
    ? {
      ...common,
      status: 'ticketed',
      receipt_due_at: decision.receiptDueAt,
      last_error: decision.error,
    }
    : {
      ...common,
      status: 'failed',
      last_error: decision.error,
    };

  const { error } = await supabase.from('notification_deliveries').update(changes)
    .eq('id', delivery.id).eq('lease_id', claimId);
  if (error) throw error;
  if (decision.type === 'failed' && decision.disableDevice) {
    const { error: deviceError } = await supabase.from('push_devices').update({
      disabled_at: new Date().toISOString(),
      disabled_reason: decision.error,
    }).eq('id', delivery.device_id).is('disabled_at', null);
    if (deviceError) throw deviceError;
  }
}

function pushMessage(delivery: ClaimedDelivery) {
  return {
    to: delivery.expo_push_token,
    title: delivery.household_name,
    body: `${delivery.actor_name} joined your household.`,
    sound: 'default',
    channelId: 'household-activity',
    data: {
      type: 'household_activity',
      listId: delivery.list_id,
      activityId: delivery.activity_id,
      userId: delivery.user_id,
    },
  };
}

function expoHeaders(): Record<string, string> {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  return {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}
