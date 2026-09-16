import { Host, Picker, Switch } from "@expo/ui";
import {
  ageGroups,
  categoryExamples,
  dietDescriptions,
  dietOptions,
  selectionOptions,
  type HouseholdPerson,
  type Selection,
  type SelectionField,
} from "@estra/profile";
import { useState, type ReactNode } from "react";
import { ScrollView, View, type TextInputProps } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

export function FormScreen({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-6 px-5 pt-5 pb-10"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="gap-2">
      <Text className="font-medium">{label}</Text>
      <Input
        accessibilityLabel={label}
        className={props.multiline ? "min-h-24 py-3" : "min-h-12"}
        {...props}
      />
    </View>
  );
}
export function FormError({ message }: { message?: string | null }) {
  return message ? (
    <Text
      selectable
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="text-destructive"
    >
      {message}
    </Text>
  ) : null;
}
export function SelectionEditor({
  field,
  value,
  onChange,
}: {
  field: SelectionField;
  value: Selection;
  onChange: (value: Selection) => void;
}) {
  const [custom, setCustom] = useState("");
  function add() {
    if (!custom.trim()) return;
    onChange({ ...value, other: [...value.other, custom.trim()] });
    setCustom("");
  }
  return (
    <View className="gap-4">
      {Object.entries(selectionOptions[field]).map(([key, label]) => (
        <View key={key} className="gap-1">
          <Host matchContents>
            <Switch
              label={label}
              value={value[key] === true}
              onValueChange={(checked) =>
                onChange({ ...value, [key]: checked })
              }
            />
          </Host>
          {categoryExamples[key] && (
            <Text className="text-sm text-muted-foreground">
              {categoryExamples[key]}
            </Text>
          )}
        </View>
      ))}
      {value.other.map((text, i) => (
        <View key={`${i}:${text}`} className="flex-row items-center gap-2">
          <Text selectable className="flex-1">
            {text}
          </Text>
          <Button
            variant="ghost"
            accessibilityLabel={`Remove ${text}`}
            onPress={() =>
              onChange({
                ...value,
                other: value.other.filter((_, index) => i !== index),
              })
            }
          >
            <Text>Remove</Text>
          </Button>
        </View>
      ))}
      <Field
        label="Add your own"
        value={custom}
        onChangeText={setCustom}
        onSubmitEditing={add}
        returnKeyType="done"
      />
      <Button variant="outline" onPress={add} disabled={!custom.trim()}>
        <Text>Add</Text>
      </Button>
    </View>
  );
}
export function DietEditor({
  person,
  onChange,
  advance,
  allowOtherDiet = false,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
  advance?: (p: HouseholdPerson) => void;
  allowOtherDiet?: boolean;
}) {
  return (
    <View className="gap-3">
      {Object.entries(dietOptions)
        .filter(([key]) => allowOtherDiet || key !== "other")
        .map(([key, label]) => (
          <Button
            key={key}
            variant={person.diet === key ? "default" : "outline"}
            className="h-auto min-h-14 flex-col items-start py-3"
            accessibilityState={{ selected: person.diet === key }}
            onPress={() => {
              const next = {
                ...person,
                diet: key as HouseholdPerson["diet"],
                diet_other: key === "other" ? person.diet_other : "",
              };
              if (advance && key !== "other") advance(next);
              else onChange(next);
            }}
          >
            <Text className="w-full font-semibold">{label}</Text>
            <Text className="w-full text-sm">
              {dietDescriptions[key as keyof typeof dietOptions]}
            </Text>
          </Button>
        ))}
      {person.diet === "other" && (
        <Field
          label="Describe your diet"
          multiline
          value={person.diet_other}
          onChangeText={(diet_other) => onChange({ ...person, diet_other })}
        />
      )}
    </View>
  );
}
export function RestrictionsEditor({
  value,
  onChange,
  none,
}: {
  value: string;
  onChange: (value: string) => void;
  none?: () => void;
}) {
  const shortcuts = ["Gluten-free", "Dairy-free", "Nut allergy", "Low carb"];
  // Only whole lines are shortcuts. Never remove matching words from a note.
  function toggle(text: string) {
    const lines = value.split("\n");
    onChange(
      lines.includes(text)
        ? lines.filter((line) => line !== text).join("\n")
        : [...(value ? lines : []), text].join("\n"),
    );
  }
  return (
    <View className="gap-4">
      <Field
        label="Allergies, restrictions, and dislikes"
        multiline
        value={value}
        onChangeText={onChange}
      />
      <View className="flex-row flex-wrap gap-2">
        {shortcuts.map((text) => (
          <Button
            key={text}
            variant={value.split("\n").includes(text) ? "default" : "outline"}
            onPress={() => toggle(text)}
          >
            <Text>{text}</Text>
          </Button>
        ))}
      </View>
      <Button
        variant="ghost"
        onPress={() => {
          onChange("");
          none?.();
        }}
      >
        <Text>None</Text>
      </Button>
    </View>
  );
}
export function PersonFields({
  person,
  onChange,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
}) {
  return (
    <>
      <Field
        label="Name"
        value={person.name}
        onChangeText={(name) => onChange({ ...person, name })}
        autoCapitalize="words"
      />
      <Text className="font-medium">Age group</Text>
      <Host matchContents>
        <Picker
          selectedValue={person.age_group}
          onValueChange={(age_group) => onChange({ ...person, age_group })}
        >
          {ageGroups.map((age) => (
            <Picker.Item key={age} value={age} label={age} />
          ))}
        </Picker>
      </Host>
      <DietEditor
        person={person}
        onChange={onChange}
        allowOtherDiet={!!person.user_id || person.diet === "other"}
      />
      <RestrictionsEditor
        value={person.restrictions}
        onChange={(restrictions) => onChange({ ...person, restrictions })}
      />
      <Field
        label="Which meals are they usually here for?"
        value={person.meal_times}
        onChangeText={(meal_times) => onChange({ ...person, meal_times })}
        multiline
      />
    </>
  );
}
