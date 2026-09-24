import {
  Collapsible,
  Column,
  Host,
  RNHostView,
  Row,
  Text as NativeText,
} from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { activityLabel, type ActivityStep } from "./activity";

function ActivityLine({
  step,
  active,
  muted,
  success,
  destructive,
}: {
  step: ActivityStep;
  active: boolean;
  muted?: string;
  success?: string;
  destructive?: string;
}) {
  const failed = step.status === "failed" || step.status === "incomplete";
  const label = activityLabel(step);

  return (
    <Row alignment="center" spacing={10}>
      {active ? (
        <RNHostView matchContents>
          <View className="size-4 items-center justify-center">
            <ActivityIndicator size="small" color={muted} />
          </View>
        </RNHostView>
      ) : (
        <RNHostView matchContents>
          <SymbolView
            name={
              failed
                ? { ios: "exclamationmark.circle", android: "error_outline" }
                : { ios: "checkmark.circle.fill", android: "check_circle" }
            }
            size={15}
            tintColor={failed ? destructive : success}
            accessibilityLabel={failed ? "Unsuccessful" : "Completed"}
          />
        </RNHostView>
      )}
      <NativeText
        textStyle={{ fontSize: 14, color: failed ? destructive : muted }}
      >
        {label}
      </NativeText>
    </Row>
  );
}

export function ActivityView({
  steps,
  busy,
  writing = false,
}: {
  steps: ActivityStep[];
  busy: boolean;
  writing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const successColor = useResolveClassNames("text-primary").color;
  const destructiveColor = useResolveClassNames("text-destructive").color;
  const muted = typeof mutedColor === "string" ? mutedColor : undefined;
  const success = typeof successColor === "string" ? successColor : undefined;
  const destructive =
    typeof destructiveColor === "string" ? destructiveColor : undefined;
  const currentIndex = steps.findIndex((step) => step.status === "running");
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  const completedCount = steps.filter((step) => step.status === "completed").length;

  if (!busy && steps.length === 0) return null;

  const label = busy
    ? current
      ? activityLabel(current)
      : writing
        ? "Writing…"
        : "Thinking…"
    : `Activity · ${steps.length} ${steps.length === 1 ? "step" : "steps"}`;

  return (
    <View className="mx-5 my-1">
      <Host matchContents>
        <Collapsible
          isOpen={expanded}
          onOpenChange={setExpanded}
          label={label}
          labelStyle={{ color: muted, fontSize: 14 }}
        >
          <Column spacing={12}>
            {steps.map((step) => (
              <ActivityLine
                key={step.id}
                step={step}
                active={step.status === "running"}
                muted={muted}
                success={success}
                destructive={destructive}
              />
            ))}
            {busy && !current ? (
              <Row alignment="center" spacing={10}>
                <RNHostView matchContents>
                  <View className="size-4 items-center justify-center">
                    <ActivityIndicator size="small" color={muted} />
                  </View>
                </RNHostView>
                <NativeText textStyle={{ fontSize: 14, color: muted }}>
                  {writing ? "Writing…" : "Thinking…"}
                </NativeText>
              </Row>
            ) : null}
          </Column>
        </Collapsible>
      </Host>
      {steps
        .filter((step) => step.status === "failed" && step.detail)
        .map((step) => (
          <Text
            key={step.id}
            variant="small"
            className="ml-6 mt-1 text-destructive"
          >
            {step.detail}
          </Text>
        ))}
      {!expanded && busy && steps.length > 1 ? (
        <View className="ml-6 mt-1">
          <Text variant="muted" className="text-xs">
            {completedCount} {completedCount === 1 ? "step" : "steps"} completed
          </Text>
        </View>
      ) : null}
    </View>
  );
}
