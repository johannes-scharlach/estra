import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";

export function SetupProgress({ step }: { step: number }) {
  const progress = useSharedValue(Math.max(0, step - 1));
  const color = useResolveClassNames("bg-primary").backgroundColor;
  useEffect(() => {
    progress.set(
      withTiming(step, {
        duration: 200,
        easing: Easing.bezier(0.77, 0, 0.175, 1),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [step, progress]);
  const style = useAnimatedStyle(() => ({
    width: `${(progress.get() / 11) * 100}%`,
  }));
  return (
    <View
      className="gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: 11, now: step }}
      accessibilityLabel="Setup progress"
    >
      <Text
        className="text-sm text-muted-foreground"
        accessibilityLiveRegion="polite"
      >
        Step {step} of 11
      </Text>
      <View className="h-1 overflow-hidden rounded-full bg-muted">
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              backgroundColor: color,
              borderRadius: 2,
            },
            style,
          ]}
        />
      </View>
    </View>
  );
}
