import type { Href } from "expo-router";

/**
 * Where a tapped household-activity push opens. A meal opens Meals on its
 * day; `at` makes a second push for the same day select it again.
 */
export function notificationRoute(
  data: Record<string, unknown>,
  responseId: string,
): Href {
  if (data.kind !== "member_joined" && typeof data.slotDate === "string") {
    return {
      pathname: "/(tabs)/meals",
      params: { date: data.slotDate, at: responseId },
    };
  }
  return "/household-activity";
}
