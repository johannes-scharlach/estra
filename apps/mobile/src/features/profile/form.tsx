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
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type TextInput,
  type TextInputProps,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { AddRow } from "@/components/add-row";
import { ChoiceList } from "@/components/choice-list";
import { Input } from "@/components/ui/input";
import { MenuPicker } from "@/components/ui/menu-picker";
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
export function Field({
  label,
  hideLabel,
  multiline,
  style,
  ref,
  ...props
}: TextInputProps & {
  label: string;
  hideLabel?: boolean;
} & React.RefAttributes<TextInput>) {
  return (
    <View className={hideLabel ? "" : "gap-2"}>
      {hideLabel ? (
        <Text className="sr-only">{label}</Text>
      ) : (
        <Text className="font-medium">{label}</Text>
      )}
      <Input
        ref={ref}
        accessibilityLabel={label}
        className={multiline ? "min-h-28 px-4 py-4" : "min-h-14 px-4"}
        multiline={multiline}
        style={[multiline ? { textAlignVertical: "top" } : undefined, style]}
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
  const [addingCustom, setAddingCustom] = useState(false);
  function add() {
    if (!custom.trim()) return;
    onChange({ ...value, other: [...value.other, custom.trim()] });
    setCustom("");
    setAddingCustom(false);
  }
  return (
    <View className="gap-3">
      <ChoiceList
        choices={Object.entries(selectionOptions[field]).map(
          ([key, title]) => ({
            key,
            title,
            detail: categoryExamples[key],
          }),
        )}
        selectedKeys={Object.keys(selectionOptions[field]).filter(
          (key) => value[key] === true,
        )}
        onSelect={(key) => onChange({ ...value, [key]: value[key] !== true })}
      >
        {value.other.map((text, index) => (
          <View
            key={`${index}:${text}`}
            className={
              index
                ? "min-h-14 flex-row items-center gap-4 border-t border-border px-4 py-3"
                : "min-h-14 flex-row items-center gap-4 px-4 py-3"
            }
          >
            <Text selectable className="flex-1 font-medium">
              {text}
            </Text>
            <Pressable
              accessibilityLabel={`Remove ${text}`}
              accessibilityRole="button"
              className="min-h-11 justify-center"
              onPress={() =>
                onChange({
                  ...value,
                  other: value.other.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              <Text className="font-medium text-primary">Remove</Text>
            </Pressable>
          </View>
        ))}
        {addingCustom ? (
          <View
            className={
              value.other.length
                ? "gap-3 border-t border-border p-4"
                : "gap-3 p-4"
            }
          >
            <Input
              autoFocus
              accessibilityLabel="Add your own"
              className="min-h-12 px-3"
              value={custom}
              onChangeText={setCustom}
              onSubmitEditing={add}
              placeholder="Add your own"
              returnKeyType="done"
            />
            <View className="flex-row items-center justify-end gap-5">
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center"
                onPress={() => {
                  setAddingCustom(false);
                  setCustom("");
                }}
              >
                <Text className="font-medium text-primary">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="min-h-11 justify-center"
                disabled={!custom.trim()}
                onPress={add}
              >
                <Text
                  className={
                    custom.trim()
                      ? "font-medium text-primary"
                      : "font-medium text-primary opacity-40"
                  }
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <AddRow
            label={value.other.length ? "Add another" : "Add your own"}
            bordered={!!value.other.length}
            onPress={() => setAddingCustom(true)}
          />
        )}
      </ChoiceList>
    </View>
  );
}
/** Label + compact select in one row; boxed on iOS, flat on Android — see
 * MealRoutineEditor's original card-in-a-card writeup for why. */
function PickerRow({
  label,
  choices,
  selectedValue,
  onValueChange,
}: {
  label: string;
  choices: readonly string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}) {
  const row = (
    <View className="min-h-16 flex-row items-center justify-between gap-4 px-4 py-3">
      <Text className="flex-1 font-medium">{label}</Text>
      <MenuPicker
        label={label}
        choices={choices}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      />
    </View>
  );
  if (Platform.OS === "android") return row;
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {row}
    </View>
  );
}
const mealRoutineChoices = [
  "Dinner",
  "Lunch and dinner",
  "All meals",
  "It varies",
] as const;

function isMealRoutine(
  value: string,
): value is (typeof mealRoutineChoices)[number] {
  return mealRoutineChoices.includes(
    value as (typeof mealRoutineChoices)[number],
  );
}

export function MealRoutineEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const isVarying = value === "It varies" || !isMealRoutine(value);
  const selectedValue = isVarying ? "It varies" : value;
  const detail = value === "It varies" ? "" : value;
  const routineRef = useRef<TextInput>(null);
  const wasVarying = useRef(isVarying);
  useEffect(() => {
    if (isVarying && !wasVarying.current) routineRef.current?.focus();
    wasVarying.current = isVarying;
  }, [isVarying]);
  return (
    <View className="gap-3">
      <PickerRow
        label="Meals at home"
        choices={mealRoutineChoices}
        selectedValue={selectedValue}
        onValueChange={onChange}
      />
      {isVarying ? (
        <Field
          ref={routineRef}
          label="Tell us about your routine"
          multiline
          value={detail}
          onChangeText={(next) => onChange(next || "It varies")}
          placeholder="Weekday dinners, lunches and dinners on weekends"
        />
      ) : null}
    </View>
  );
}
export function DietEditor({
  person,
  onChange,
  allowOtherDiet = false,
  compact = false,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
  allowOtherDiet?: boolean;
  compact?: boolean;
}) {
  const entries = Object.entries(dietOptions).filter(
    ([key]) => allowOtherDiet || key !== "other",
  );
  return (
    <View className="gap-3">
      {compact ? (
        <PickerRow
          label="Diet"
          choices={entries.map(([, title]) => title)}
          selectedValue={dietOptions[person.diet]}
          onValueChange={(title) => {
            const key = entries.find(([, t]) => t === title)?.[0] as
              | HouseholdPerson["diet"]
              | undefined;
            if (!key) return;
            onChange({
              ...person,
              diet: key,
              diet_other: key === "other" ? person.diet_other : "",
            });
          }}
        />
      ) : (
        <ChoiceList
          choices={entries.map(([key, title]) => ({
            key,
            title,
            detail: dietDescriptions[key as keyof typeof dietOptions],
          }))}
          selectedKeys={[person.diet]}
          selection="single"
          onSelect={(key) =>
            onChange({
              ...person,
              diet: key as HouseholdPerson["diet"],
              diet_other: key === "other" ? person.diet_other : "",
            })
          }
        />
      )}
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
  hideLabel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  placeholder?: string;
}) {
  return (
    <Field
      label="Allergies & ingredients"
      hideLabel={hideLabel}
      multiline
      value={value}
      onChangeText={onChange}
      placeholder={
        placeholder ?? "e.g. Peanuts, gluten, shellfish, mushrooms, cilantro"
      }
    />
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
      <PickerRow
        label="Age group"
        choices={ageGroups}
        selectedValue={person.age_group}
        onValueChange={(age_group) =>
          onChange({
            ...person,
            age_group: age_group as HouseholdPerson["age_group"],
          })
        }
      />
      <DietEditor
        person={person}
        onChange={onChange}
        allowOtherDiet={!!person.user_id || person.diet === "other"}
        compact
      />
      <Field
        label="Which meals are they usually here for?"
        value={person.meal_times}
        onChangeText={(meal_times) => onChange({ ...person, meal_times })}
      />
    </>
  );
}
