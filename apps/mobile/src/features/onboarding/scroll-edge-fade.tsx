import { LinearGradient } from "expo-linear-gradient";
import { useResolveClassNames } from "uniwind";

const FADE_RUN = 20;

/** Smooth gradient behind the status bar or floating action buttons so scrolled content fades naturally. */
export function ScrollEdgeFade({
  height,
  edge = "bottom",
}: {
  height: number;
  edge?: "top" | "bottom";
}) {
  const token = useResolveClassNames("bg-background").backgroundColor;
  const background = typeof token === "string" ? token : "#FBF8F4";
  const fadeHeight = height + FADE_RUN;
  if (edge === "top") {
    const solidStop = fadeHeight > 0 ? Math.min(height / fadeHeight, 0.75) : 0;
    return (
      <LinearGradient
        colors={[
          background,
          background,
          `${background}80`,
          `${background}00`,
        ]}
        locations={[0, solidStop, (solidStop + 1) / 2, 1]}
        style={{
          pointerEvents: "none",
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: fadeHeight,
        }}
      />
    );
  }
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
