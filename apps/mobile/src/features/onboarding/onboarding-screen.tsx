import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

const BACK_ICON = { ios: "chevron.left", android: "arrow_back" } as const;

type OnboardingArt = {
  source: number;
  accessibilityLabel: string;
  aspectRatio?: number;
};

type OnboardingAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function OnboardingScreen({
  children,
  title,
  subtitle,
  step,
  art,
  onBack,
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  step?: number;
  art?: OnboardingArt;
  onBack?: () => void;
  action?: OnboardingAction;
}) {
  const insets = useSafeAreaInsets();
  const iconColor = useResolveClassNames("text-foreground").color;
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <View className="flex-1">
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow gap-6 px-6 pb-28"
          contentContainerStyle={{
            paddingTop: insets.top + (onBack && !step ? 64 : 18),
          }}
        >
          {step ? (
            <View
              accessibilityLabel="Setup progress"
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 1, max: 11, now: step }}
              className="self-end"
            >
              <Text className="text-sm text-muted-foreground">
                {step} of 11
              </Text>
            </View>
          ) : null}
          {title ? (
            <View className="gap-2">
              <Text
                accessibilityRole="header"
                className="text-[28px] font-bold leading-[34px] tracking-tight"
              >
                {title}
              </Text>
              {subtitle ? (
                <Text className="text-base leading-6 text-muted-foreground">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {art ? (
            <View
              className="overflow-hidden rounded-2xl border border-border"
              style={{ borderCurve: "continuous" }}
            >
              <Image
                source={art.source}
                accessibilityLabel={art.accessibilityLabel}
                contentFit="cover"
                style={{ width: "100%", aspectRatio: art.aspectRatio ?? 2 }}
              />
            </View>
          ) : null}
          {children}
        </ScrollView>
        {onBack ? (
          <View
            pointerEvents="box-none"
            style={{ left: 16, position: "absolute", top: insets.top + 10 }}
          >
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-card/80"
              onPress={onBack}
              style={{ borderCurve: "continuous" }}
            >
              <GlassView
                isInteractive
                style={{
                  bottom: 0,
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              />
              <SymbolView name={BACK_ICON} size={20} tintColor={iconColor} />
            </Pressable>
          </View>
        ) : null}
        {action ? (
          <View
            pointerEvents="box-none"
            className="absolute bottom-0 left-0 right-0 px-6 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 14) }}
          >
            <Button
              className="min-h-14 rounded-full"
              disabled={action.disabled}
              onPress={action.onPress}
            >
              <Text className="text-[17px] font-semibold">{action.label}</Text>
            </Button>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
