import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { onboardingArt } from "./art";

const STARTUP_TIMEOUT_MS = 15_000;

export function StartupScreen({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const insets = useSafeAreaInsets();
  const indicatorColor = useResolveClassNames("text-primary").color;
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // One waiting period spans session, draft and household loading. Changing
  // phases must not flash recovery controls or restart the clock.
  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [attempt]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="never"
      contentContainerClassName="flex-grow items-center justify-center px-6"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View className="w-full max-w-md gap-6">
        <Text className="text-center text-[25px] font-semibold tracking-tight text-primary">
          estra
        </Text>
        <View
          className="overflow-hidden rounded-2xl"
          style={{ borderCurve: "continuous" }}
        >
          <Image
            source={onboardingArt.welcome.source}
            accessibilityLabel={onboardingArt.welcome.accessibilityLabel}
            contentFit="cover"
            style={{ width: "100%", aspectRatio: 1 }}
          />
        </View>
        <View className="min-h-36 items-center gap-4">
          {timedOut ? (
            <>
              <Text accessibilityLiveRegion="polite" className="text-center font-medium">
                This is taking longer than usual.
              </Text>
              {error ? (
                <Text selectable className="text-center text-muted-foreground">
                  {error}
                </Text>
              ) : null}
              <Button
                className="min-h-12 rounded-full px-8"
                onPress={() => {
                  setTimedOut(false);
                  setAttempt((n) => n + 1);
                  onRetry();
                }}
              >
                <Text>Retry</Text>
              </Button>
            </>
          ) : (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Getting things ready"
              className="flex-row items-center gap-3"
            >
              <ActivityIndicator color={indicatorColor} />
              <Text className="text-muted-foreground">Getting things ready…</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
