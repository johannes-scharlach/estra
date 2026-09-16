import AsyncStorage from "@react-native-async-storage/async-storage";
import { restoreDraft, type OnboardingDraft } from "./draft";

const KEY = "estra.onboarding.v1";
let pending: Promise<void> = Promise.resolve();

/** Serialize keystroke writes and cleanup so an older write cannot resurrect a draft. */
export function saveDraft(draft: OnboardingDraft | null): Promise<void> {
  const serialized = draft ? JSON.stringify(draft) : null;
  pending = pending
    .catch(() => {})
    .then(() =>
      serialized === null
        ? AsyncStorage.removeItem(KEY)
        : AsyncStorage.setItem(KEY, serialized),
    );
  return pending;
}
export async function loadDraft(): Promise<OnboardingDraft | null> {
  await pending.catch(() => {});
  return restoreDraft(await AsyncStorage.getItem(KEY));
}
