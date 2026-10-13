import { avoidanceKinds, type IngredientAvoidance } from "@magpie/profile";
import { useRef, useState } from "react";
import { Pressable, View, type TextInput } from "react-native";
import { PrimaryAction } from "@/components/action";
import { EditorSheet } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { MenuPicker } from "@/components/ui/menu-picker";
import { Field } from "@/features/profile/form";

const suggestions: IngredientAvoidance[] = [
  { ingredient: "Peanuts", kind: "allergy", detail: "" },
  { ingredient: "Shellfish", kind: "allergy", detail: "" },
  { ingredient: "Gluten", kind: "restriction", detail: "" },
  { ingredient: "Dairy", kind: "restriction", detail: "" },
  { ingredient: "Coriander", kind: "dislike", detail: "" },
  { ingredient: "Mushrooms", kind: "dislike", detail: "" },
  { ingredient: "Olives", kind: "dislike", detail: "" },
];

export function AvoidancesEditor({ value, onChange, notes, onNotes }: {
  value: IngredientAvoidance[];
  onChange: (value: IngredientAvoidance[]) => void;
  notes: string;
  onNotes: (notes: string) => void;
}) {
  const [editing, setEditing] = useState<{ index: number; item: IngredientAvoidance } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const input = useRef<TextInput>(null);
  function open(item: IngredientAvoidance, index = -1) { setAttempted(false); setEditing({ item: { ...item }, index }); }
  function save() {
    if (!editing) return;
    if (!editing.item.ingredient.trim()) { setAttempted(true); input.current?.focus(); return; }
    const item = { ...editing.item, ingredient: editing.item.ingredient.trim(), detail: editing.item.detail.trim() };
    onChange(editing.index < 0 ? [...value, item] : value.map((entry, index) => index === editing.index ? item : entry));
    setEditing(null);
  }
  return (
    <View className="gap-8">
      {[false, true].map((dislikes) => (
        <View key={String(dislikes)} className="gap-3">
          <Text className="text-lg font-semibold">{dislikes ? "Things you don’t enjoy" : "Allergies & must-avoids"}</Text>
          <View className="flex-row flex-wrap gap-2">
            {value.map((item, index) => (item.kind === "dislike") === dislikes ? (
              <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Edit ${item.ingredient}, ${avoidanceKinds[item.kind]}${item.detail ? `, ${item.detail}` : ""}`} className="min-h-11 gap-1 rounded-2xl border border-primary bg-accent px-4 py-3" onPress={() => open(item, index)}>
                <Text className="font-medium">{item.ingredient}</Text>
                <Text className="text-xs text-muted-foreground">{[avoidanceKinds[item.kind], item.detail].filter(Boolean).join(" · ")}</Text>
              </Pressable>
            ) : null)}
            {suggestions.filter((item) => (item.kind === "dislike") === dislikes && !value.some((entry) => entry.ingredient.toLowerCase() === item.ingredient.toLowerCase())).map((item) => (
              <Pressable key={item.ingredient} accessibilityRole="button" accessibilityLabel={`Add ${item.ingredient}`} className="min-h-11 justify-center rounded-full border border-border bg-card px-4 py-2" onPress={() => open(item)}>
                <Text>{item.ingredient}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" className="min-h-11 justify-center self-start" onPress={() => open({ ingredient: "", kind: dislikes ? "dislike" : "restriction", detail: "" })}>
            <Text className="font-medium text-primary">+ Add something</Text>
          </Pressable>
        </View>
      ))}
      {notes ? <Field label="Your existing notes" multiline value={notes} onChangeText={onNotes} /> : null}
      {!value.length && !notes.trim() ? <Text className="text-sm text-muted-foreground">Nothing to avoid? Just continue.</Text> : null}
      {editing ? (
        <EditorSheet title={editing.index < 0 ? "Add an ingredient" : "Edit ingredient"} onDismiss={() => setEditing(null)}>
          <Field ref={input} label="Ingredient" value={editing.item.ingredient} onChangeText={(ingredient) => setEditing({ ...editing, item: { ...editing.item, ingredient } })} autoFocus={!editing.item.ingredient} error={attempted && !editing.item.ingredient.trim() ? "Enter an ingredient." : null} />
          <View className="min-h-14 flex-row items-center justify-between gap-4">
            <Text className="font-medium">Reason</Text>
            <MenuPicker label="Reason" choices={Object.values(avoidanceKinds)} selectedValue={avoidanceKinds[editing.item.kind]} onValueChange={(label) => {
              const kind = (Object.keys(avoidanceKinds) as IngredientAvoidance["kind"][]).find((key) => avoidanceKinds[key] === label)!;
              setEditing({ ...editing, item: { ...editing.item, kind } });
            }} />
          </View>
          <Field label="Details (optional)" placeholder="e.g. Only Sam" value={editing.item.detail} onChangeText={(detail) => setEditing({ ...editing, item: { ...editing.item, detail } })} />
          <PrimaryAction label={editing.index < 0 ? "Add" : "Save"} onPress={save} />
          {editing.index >= 0 ? <Pressable accessibilityRole="button" className="min-h-11 items-center justify-center" onPress={() => { onChange(value.filter((_, index) => index !== editing.index)); setEditing(null); }}><Text className="font-medium text-destructive">Remove ingredient</Text></Pressable> : null}
        </EditorSheet>
      ) : null}
    </View>
  );
}
