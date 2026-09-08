import { useSyncExternalStore } from "react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { AppState } from "react-native";

import { ImportJobs } from "./import-jobs";
import { importRecipe, waitForMeal } from "./import-adapters";

// App lifetime, independent of a particular sheet or tab mount.
const importJobs = new ImportJobs({
  createOperationId: Crypto.randomUUID,
  importRecipe,
  waitForMeal,
  onCompleted: () => {
    if (AppState.currentState === "active") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  },
});

export function useImportJobs(): ImportJobs {
  useSyncExternalStore(importJobs.subscribe, importJobs.getSnapshot);
  return importJobs;
}
