import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Action, PrimaryAction } from "@/components/action";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import { createHousehold, renameList } from "@/db/lists";
import { useAuth } from "@/db/provider";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { Field, FormError } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";
import { cn } from "@/lib/utils";

const ON_ICON = { ios: "checkmark.circle.fill", android: "check_circle" } as const;
const OFF_ICON = { ios: "circle", android: "radio_button_unchecked" } as const;

type Naming = { kind: "rename" | "create"; name: string };

/** Switch the active household, rename it, or start a new one. */
export default function SwitchHousehold() {
  const router = useRouter();
  const { session } = useAuth();
  const { listId, households, switchHousehold } = useHouseholdAccess();
  const { household } = useHousehold(listId);
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const [naming, setNaming] = useState<Naming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = households.find((h) => h.id === listId);

  function pick(id: string) {
    switchHousehold(id);
    router.back();
  }

  async function save() {
    if (busy || !naming || !listId || !session) return;
    setBusy(true);
    setError(null);
    try {
      if (naming.kind === "rename") {
        await renameList(listId, naming.name);
        setNaming(null);
      } else {
        pick(await createHousehold(naming.name, session.user.id, household));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-6 px-6 pb-6 pt-4"
    >
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 text-lg font-semibold">
          {naming?.kind === "create"
            ? "New household"
            : naming?.kind === "rename"
              ? "Rename household"
              : "Households"}
        </Text>
        <CloseButton onPress={() => router.back()} disabled={busy} />
      </View>
      <FormError message={error} />
      {naming ? (
        <>
          <Field
            label="Name"
            value={naming.name}
            onChangeText={(name) => setNaming({ ...naming, name })}
            placeholder="e.g. Home, Holiday flat"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void save()}
          />
          <View className="gap-2">
            <PrimaryAction
              label={
                busy ? "Saving…" : naming.kind === "create" ? "Create" : "Save"
              }
              disabled={busy || !naming.name.trim()}
              onPress={() => void save()}
            />
            <Action
              label="Cancel"
              disabled={busy}
              onPress={() => {
                setError(null);
                setNaming(null);
              }}
            />
          </View>
        </>
      ) : (
        <>
          {/* Same grouped look as the Profile list. */}
          <View className="overflow-hidden rounded-2xl bg-card">
            {households.map((h, i) => {
              const on = h.id === listId;
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => pick(h.id)}
                  className={cn(
                    "flex-row items-center justify-between px-4 py-3.5 active:bg-muted",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <Text className="text-base">{h.name}</Text>
                  <SymbolView
                    name={on ? ON_ICON : OFF_ICON}
                    tintColor={on ? primary : muted}
                    size={22}
                  />
                </Pressable>
              );
            })}
          </View>
          <View className="gap-2">
            {active && (
              <Action
                label={`Rename “${active.name}”`}
                onPress={() => setNaming({ kind: "rename", name: active.name })}
              />
            )}
            <Action
              label="New household"
              onPress={() => setNaming({ kind: "create", name: "" })}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
