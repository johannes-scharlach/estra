import { FunctionsHttpError } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const previewSchema = z.object({
  list_id: z.uuid(),
  name: z.string(),
  joined: z.boolean(),
  people: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type InvitationPreview = z.infer<typeof previewSchema>;
export class InvitationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request(body: Record<string, unknown>): Promise<unknown> {
  try {
    const { data, error } = await supabase.functions.invoke("join-list", {
      body,
    });
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const detail = await response.json().catch(() => null);
      // Gateway failures never reach our handler and use `message`, not
      // `error`. Preserve their status so these failures remain diagnosable.
      const fallback = typeof detail?.message === "string"
        ? detail.message
        : "Invitation service request failed";
      const message = typeof detail?.error === "string"
        ? detail.error
        : `${fallback} (HTTP ${response.status})`;
      throw new InvitationError(message, response.status);
    }
    if (error) {
      throw new Error(
        "Could not reach Estra. Check your connection and try again.",
        { cause: error },
      );
    }
    return data;
  } catch (error) {
    // Do not log the request body: it contains the bearer code or a name.
    console.error("Household invitation request failed", {
      function: "join-list",
      action: body.action,
      ...(error instanceof InvitationError
        ? { status: error.status }
        : { cause: error instanceof Error ? error.cause ?? error : error }),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function previewInvitation(code: string) {
  return previewSchema.parse(
    await request({ action: "preview", invite_code: code }),
  );
}
export async function acceptInvitation(
  code: string,
  choice: { person_id: string } | { name: string },
) {
  return z.object({ list_id: z.uuid() }).parse(
    await request({ action: "join", invite_code: code, ...choice }),
  ).list_id;
}
export async function householdInviteCode(listId: string, reset = false) {
  return z.object({ invite_code: z.string().regex(/^[0-9a-f]{32}$/) }).parse(
    await request({ action: reset ? "reset" : "share", list_id: listId }),
  ).invite_code;
}
