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
  const { data, error } = await supabase.functions.invoke("join-list", {
    body,
  });
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const detail = await response.json().catch(() => null);
    throw new InvitationError(
      typeof detail?.error === "string"
        ? detail.error
        : "Could not load the invitation. Try again.",
      response.status,
    );
  }
  if (error) {
    throw new Error(
      "Could not reach Estra. Check your connection and try again.",
    );
  }
  return data;
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
