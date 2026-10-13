import { LinearGradient } from "expo-linear-gradient";
import { useResolveClassNames } from "uniwind";

const FADE_RUN = 20;

/** Smooth gradient behind the floating action buttons so content fades naturally behind them rather than above them. */
export function ScrollEdgeFade({ height }: { height: number }) {
  const token = useResolveClassNames("bg-background").backgroundColor;
  const background = typeof token === "string" ? token : "#FBF8F4";
  const fadeHeight = height + FADE_RUN;
  return (
    <LinearGradient
      colors={[
        `${background}00`,
        `${background}66`,
        `${background}D9`,
        background,
      ]}
      locations={[0, 0.35, 0.75, 1]}
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: fadeHeight,
      }}
    />
  );
}
