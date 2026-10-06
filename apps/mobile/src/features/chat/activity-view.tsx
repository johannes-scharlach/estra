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
}: {
  step: ActivityStep;
  active: boolean;
  muted?: string;
  success?: string;
}) {
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
            name={{ ios: "checkmark.circle.fill", android: "check_circle" }}
            size={15}
            tintColor={success}
            accessibilityLabel="Completed"
          />
        </RNHostView>
      )}
      <NativeText textStyle={{ fontSize: 14, color: muted }}>
        {label}
      </NativeText>
    </Row>
  );
}

export function ActivityView({
  steps,
  busy,
  writing = false,
  waiting = false,
}: {
  steps: ActivityStep[];
  busy: boolean;
  writing?: boolean;
  waiting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const successColor = useResolveClassNames("text-primary").color;
  const muted = typeof mutedColor === "string" ? mutedColor : undefined;
  const success = typeof successColor === "string" ? successColor : undefined;
  const currentIndex = steps.findIndex((step) => step.status === "running");
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  const completedCount = steps.filter(
    (step) => step.status === "completed",
  ).length;

  if (!busy && steps.length === 0) return null;

  const label = busy
    ? waiting
      ? "Waiting for reply…"
      : current
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
                  {waiting
                    ? "Waiting for reply…"
                    : writing
                      ? "Writing…"
                      : "Thinking…"}
                </NativeText>
              </Row>
            ) : null}
          </Column>
        </Collapsible>
      </Host>
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
