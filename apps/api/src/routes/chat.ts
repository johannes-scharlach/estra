import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from 'ai';
import { Hono } from 'hono';

import type { AppBindings } from '../auth.js';
import { env } from '../env.js';

export const chat = new Hono<AppBindings>();

// The provider reads GOOGLE_GENERATIVE_AI_API_KEY itself if you let it, but
// then a missing key surfaces on the first chat message rather than at boot.
// env.ts exists to make that noisy, so hand it the key explicitly.
const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

/**
 * Speaks the AI SDK's UI message stream protocol both ways: the body is the
 * `UIMessage[]` that `useChat` posts, and the response is what it expects
 * back. That is why there is no hand-rolled SSE here — a client is a plain
 * `useChat({ transport })` with no custom parsing.
 *
 * The whole conversation arrives on every request. Nothing is stored here;
 * the server holds no history of its own.
 */
chat.post('/', async (c) => {
  const body = await c.req.json<{ messages?: unknown }>().catch(() => ({ messages: undefined }));
  const validated = await safeValidateUIMessages({ messages: body.messages });

  if (!validated.success) return c.json({ error: 'messages must be a UIMessage[]' }, 400);
  if (validated.data.length === 0) return c.json({ error: 'messages is empty' }, 400);

  const result = streamText({
    model: google('gemini-3.7-flash'),
    messages: await convertToModelMessages(validated.data),
    // A phone that backgrounds the app drops the connection mid-stream.
    // That is normal, not an error — but without this we keep generating,
    // and paying for, tokens no one will read.
    abortSignal: c.req.raw.signal,
  });

  // Standalone helpers over `result.stream`, not `result.toUIMessageStream*()`
  // — those are deprecated in v7 and go away in the next major.
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
});
