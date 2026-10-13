import { LinearGradient } from "expo-linear-gradient";
import { useResolveClassNames } from "uniwind";

const FADE_RUN = 40;

/** Same fade as the recipe screen. Only the buttons themselves have glass. */
export function ScrollEdgeFade({ height }: { height: number }) {
  const token = useResolveClassNames("bg-background").backgroundColor;
  const background = typeof token === "string" ? token : "#FBF8F4";
  const fadeHeight = height + FADE_RUN;
  return (
    <LinearGradient
      colors={[`${background}00`, `${background}BF`, `${background}BF`]}
      locations={[0, FADE_RUN / fadeHeight, 1]}
      style={{ pointerEvents: "none", position: "absolute", left: 0, right: 0, bottom: 0, height: fadeHeight }}
    />
  );
}
