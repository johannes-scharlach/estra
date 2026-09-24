import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { dateKey } from "@/features/meals/slots";

/** Calendar labels must catch up after midnight and after backgrounding. */
export function useToday() {
  const [today, setToday] = useState(() => dateKey(new Date()));
  const refresh = useCallback(() => setToday(dateKey(new Date())), []);
  useFocusEffect(refresh);
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [refresh, today]);
  return today;
}
