import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState, useRef } from "react";
import { Pressable, View, useWindowDimensions, type TextInput } from "react-native";
import { useResolveClassNames } from "uniwind";
import {
  selectionOptions,
  goalOptions,
  legacyPantryOptions,
  legacyFreshOptions,
  type Selection,
  type SelectionField,
} from "@magpie/profile";
import { PrimaryAction } from "@/components/action";
import { AddRow } from "@/components/add-row";
import { ChoiceList } from "@/components/choice-list";
import { EditorSheet } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { Artwork, type ArtworkId } from "@/features/onboarding/artwork";
import { Field } from "@/features/profile/form";

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={
        selected
          ? "min-h-11 flex-row items-center gap-2 rounded-full border border-primary bg-accent px-4 py-2"
          : "min-h-11 flex-row items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
      }
    >
      {selected ? <Text className="text-primary">✓</Text> : null}
      <Text className="flex-shrink font-medium">{label}</Text>
    </Pressable>
  );
}

export function ChoiceTiles({
  field,
  value,
  onChange,
}: {
  field: SelectionField;
  value: Selection;
  onChange: (value: Selection) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const [showPrevious, setShowPrevious] = useState(false);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [attempted, setAttempted] = useState(false);
  const input = useRef<TextInput>(null);

  function add() {
    if (!custom.trim()) {
      setAttempted(true);
      input.current?.focus();
      return;
    }
    if (!value.other.some((item) => item.toLowerCase() === custom.trim().toLowerCase())) {
      onChange({ ...value, other: [...value.other, custom.trim()] });
    }
    setAdding(false);
  }

  // Goals are intentions, not tangible objects: render as a clear multi-select list.
  if (field === "goals") {
    const presetChoices = Object.entries(goalOptions).map(([key, title]) => ({
      key,
      title,
    }));
    const customChoices = value.other.map((title, index) => ({
      key: `other:${index}`,
      title,
    }));
    const choices = [...presetChoices, ...customChoices];
    const selectedKeys = [
      ...presetChoices.map((c) => c.key).filter((key) => value[key] === true),
      ...customChoices.map((c) => c.key),
    ];

    return (
      <View className="gap-4">
        <ChoiceList
          choices={choices}
          selectedKeys={selectedKeys}
          selection="multiple"
          onSelect={(key) => {
            void Haptics.selectionAsync().catch(() => {});
            if (key.startsWith("other:")) {
              const target = Number(key.slice("other:".length));
              onChange({
                ...value,
                other: value.other.filter((_, i) => i !== target),
              });
              return;
            }
            onChange({ ...value, [key]: !value[key] });
          }}
        >
          <AddRow
            label="Add a goal"
            bordered={false}
            onPress={() => {
              setCustom("");
              setAttempted(false);
              setAdding(true);
            }}
          />
        </ChoiceList>
        {adding ? (
          <EditorSheet title="Your goal" onDismiss={() => setAdding(false)}>
            <Field
              ref={input}
              label="What would help?"
              value={custom}
              onChangeText={setCustom}
              autoFocus
              error={attempted && !custom.trim() ? "Enter a few words." : null}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <PrimaryAction label="Add" onPress={add} />
          </EditorSheet>
        ) : null}
      </View>
    );
  }

  const staples = field === "pantry" || field === "fresh_ingredients";
  const columns = fontScale > 1.5 ? 1 : staples && width >= 370 && fontScale <= 1.1 ? 3 : 2;
  const gap = 10;
  const tileWidth = (width - 48 - gap * (columns - 1)) / columns;
  const options = Object.entries(selectionOptions[field]);
  const visible = options;
  const legacy: Record<string, string> =
    field === "pantry"
      ? legacyPantryOptions
      : field === "fresh_ingredients"
        ? legacyFreshOptions
        : {};
  const oldSelections = Object.entries(legacy).filter(
    ([key]) => !(key in selectionOptions[field]) && value[key] === true,
  );
  const prefix =
    field === "kitchen_equipment"
      ? "equipment"
      : field === "fresh_ingredients"
        ? "fresh"
        : "pantry";

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap" style={{ gap }}>
        {visible.map(([key, title]) => {
          const selected = value[key] === true;
          return (
            <Pressable
              key={key}
              accessibilityRole="checkbox"
              accessibilityLabel={title}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                onChange({ ...value, [key]: !selected });
              }}
              style={{ width: tileWidth, borderCurve: "continuous" }}
              className={
                selected
                  ? "gap-2 rounded-2xl border border-primary bg-accent p-2"
                  : "gap-2 rounded-2xl border border-border bg-card p-2 active:bg-secondary"
              }
            >
              <Artwork id={`${prefix}-${key}` as ArtworkId} />
              <View className="min-h-11 flex-row items-center gap-1">
                <Text className="flex-1 text-sm font-medium">{title}</Text>
                <SymbolView
                  name={
                    selected
                      ? { ios: "checkmark.circle.fill", android: "check_circle" }
                      : { ios: "circle", android: "radio_button_unchecked" }
                  }
                  size={18}
                  tintColor={selected ? primary : muted}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
      {oldSelections.length ? (
        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showPrevious }}
            className="min-h-11 justify-center"
            onPress={() => setShowPrevious(!showPrevious)}
          >
            <Text className="text-sm text-muted-foreground">
              Earlier selections · {oldSelections.length}
            </Text>
          </Pressable>
          {showPrevious ? (
            <View className="flex-row flex-wrap items-start gap-2">
              {oldSelections.map(([key, label]) => (
                <ChoiceChip
                  key={key}
                  label={label}
                  selected
                  onPress={() => onChange({ ...value, [key]: false })}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <View className="flex-row flex-wrap items-start gap-2">
        {value.other.map((label, index) => (
          <ChoiceChip
            key={`${index}:${label}`}
            label={label}
            selected
            onPress={() =>
              onChange({
                ...value,
                other: value.other.filter((_, i) => i !== index),
              })
            }
          />
        ))}
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center rounded-full border border-border bg-card px-4 py-2"
          onPress={() => {
            setCustom("");
            setAttempted(false);
            setAdding(true);
          }}
        >
          <Text className="font-medium text-primary">+ Add something</Text>
        </Pressable>
      </View>
      {adding ? (
        <EditorSheet
          title={field === "kitchen_equipment" ? "Add equipment" : "Add an ingredient"}
          onDismiss={() => setAdding(false)}
        >
          <Field
            ref={input}
            label="Name"
            value={custom}
            onChangeText={setCustom}
            autoFocus
            error={attempted && !custom.trim() ? "Enter a few words." : null}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <PrimaryAction label="Add" onPress={add} />
        </EditorSheet>
      ) : null}
    </View>
  );
}
