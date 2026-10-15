import {
  ageGroups,
  dietDescriptions,
  dietOptions,
  portionReferenceRange,
  type HouseholdPerson,
} from "@magpie/profile";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type TextInput,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { ChoiceList } from "@/components/choice-list";
import { Input } from "@/components/ui/input";
import { MenuPicker } from "@/components/ui/menu-picker";
import { Text } from "@/components/ui/text";
import { Slider } from "@expo/ui/community/slider";
import { useResolveClassNames } from "uniwind";

export function FormScreen({
  children,
  contentContainerClassName,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        // The inset padding exists so screens without a stack header keep
        // their place below the status bar (see join.tsx).
        contentContainerClassName={
          contentContainerClassName ?? "gap-6 px-5 pt-5 pb-10"
        }
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Field({
  label,
  hideLabel,
  error,
  validationAttempt,
  multiline,
  style,
  ref,
  ...props
}: TextInputProps & {
  label: string;
  hideLabel?: boolean;
  /** Shown under the input, where the eye already is. */
  error?: string | null;
  validationAttempt?: number;
} & React.RefAttributes<TextInput>) {
  const input = useRef<TextInput>(null);
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error, validationAttempt]);
  return (
    <View className="gap-2">
      {hideLabel ? (
        <Text className="sr-only">{label}</Text>
      ) : (
        <Text className="font-medium">{label}</Text>
      )}
      <Input
        ref={(node) => {
          input.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        accessibilityLabel={label}
        className={`${multiline ? "min-h-28 px-4 py-4" : "min-h-14 px-4"}${error ? " border-destructive" : ""}`}
        multiline={multiline}
        style={[multiline ? { textAlignVertical: "top" } : undefined, style]}
        {...props}
      />
      <FormError message={error} />
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
/** Label + compact select in one row; boxed on iOS, flat on Android — see
 * MealRoutineEditor's original card-in-a-card writeup for why. */
export function PickerRow({
  label,
  choices,
  selectedValue,
  onValueChange,
  grouped = false,
}: {
  label: string;
  choices: readonly string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  grouped?: boolean;
}) {
  const row = (
    <View className="min-h-14 flex-row items-center justify-between gap-4 px-4 py-3">
      <Text className="flex-1 font-medium">{label}</Text>
      <MenuPicker
        label={label}
        choices={choices}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      />
    </View>
  );
  if (Platform.OS === "android" || grouped) return row;
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
  grouped = false,
  otherError,
  validationAttempt,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
  allowOtherDiet?: boolean;
  compact?: boolean;
  grouped?: boolean;
  otherError?: string | null;
  validationAttempt?: number;
}) {
  const entries = Object.entries(dietOptions).filter(
    ([key]) => allowOtherDiet || key !== "other",
  );
  const isOther = person.diet === "other";
  const otherRef = useRef<TextInput>(null);
  const wasOther = useRef(isOther);
  useEffect(() => {
    if (isOther && !wasOther.current) otherRef.current?.focus();
    wasOther.current = isOther;
  }, [isOther]);
  return (
    <View className="gap-3">
      {compact ? (
        <PickerRow
          label="Diet"
          grouped={grouped}
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
      {isOther && (
        <Field
          ref={otherRef}
          label="Describe your diet"
          placeholder="e.g. Halal, kosher, low FODMAP"
          error={otherError}
          validationAttempt={validationAttempt}
          value={person.diet_other}
          onChangeText={(diet_other) => onChange({ ...person, diet_other })}
          returnKeyType="done"
        />
      )}
    </View>
  );
}
export function PersonFields({
  person,
  onChange,
  autoFocusName,
  errors,
  validationAttempt,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
  autoFocusName?: boolean;
  errors?: Record<string, string>;
  validationAttempt?: number;
}) {
  const ageAndDiet = (
    <>
      <PickerRow
        label="Age group"
        grouped={Platform.OS === "ios"}
        choices={ageGroups}
        selectedValue={person.age_group}
        onValueChange={(age_group) =>
          onChange({
            ...person,
            age_group: age_group as HouseholdPerson["age_group"],
          })
        }
      />
      {Platform.OS === "ios" ? (
        <View className="ml-4 border-t border-border" />
      ) : null}
      <DietEditor
        person={person}
        onChange={onChange}
        allowOtherDiet
        compact
        grouped={Platform.OS === "ios"}
        otherError={
          errors?.diet_other && !person.diet_other.trim()
            ? errors.diet_other
            : null
        }
        validationAttempt={validationAttempt}
      />
    </>
  );
  return (
    <>
      <Field
        label="Name"
        error={errors?.name && !person.name.trim() ? errors.name : null}
        validationAttempt={validationAttempt}
        value={person.name}
        onChangeText={(name) => onChange({ ...person, name })}
        autoCapitalize="words"
        autoFocus={autoFocusName}
        returnKeyType="done"
      />
      {Platform.OS === "ios" && person.diet !== "other" ? (
        <View
          className="overflow-hidden rounded-xl border border-border bg-card"
          style={{ borderCurve: "continuous" }}
        >
          {ageAndDiet}
        </View>
      ) : (
        <>
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
            allowOtherDiet
            compact
            otherError={
              errors?.diet_other && !person.diet_other.trim()
                ? errors.diet_other
                : null
            }
            validationAttempt={validationAttempt}
          />
        </>
      )}
      <PortionReference
        value={person.portion_reference}
        onChange={(portion_reference) =>
          onChange({ ...person, portion_reference })
        }
      />
      <Field
        label="Which meals are they usually here for?"
        value={person.meal_times}
        onChangeText={(meal_times) => onChange({ ...person, meal_times })}
        returnKeyType="done"
      />
    </>
  );
}

function PortionReference({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const primary = useResolveClassNames("text-primary").color;
  const track = useResolveClassNames("bg-muted").backgroundColor;
  const stepsPerPortion = 1 / portionReferenceRange.step;
  const snapToStep = (next: number) =>
    Math.round(next * stepsPerPortion) / stepsPerPortion;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="font-medium">Usual portion</Text>
        <Text className="font-semibold tabular-nums">{value}</Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Usual portion"
        accessibilityHint="1 is a regular adult portion"
        accessibilityValue={{
          min: portionReferenceRange.min,
          max: portionReferenceRange.max,
          now: value,
          text: `${value} portions`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          onChange(
            Math.min(
              portionReferenceRange.max,
              Math.max(
                portionReferenceRange.min,
                snapToStep(
                  value +
                    (event.nativeEvent.actionName === "increment"
                      ? portionReferenceRange.step
                      : -portionReferenceRange.step),
                ),
              ),
            ),
          )
        }
      >
        <Slider
          minimumValue={portionReferenceRange.min}
          maximumValue={portionReferenceRange.max}
          step={Platform.OS === "ios" ? portionReferenceRange.step : undefined}
          value={value}
          onValueChange={(next) => onChange(snapToStep(next))}
          minimumTrackTintColor={primary}
          maximumTrackTintColor={track}
          {...(Platform.OS === "android" && {
            thumbTintColor: primary,
          })}
          style={{ width: "100%", height: 32 }}
        />
      </View>
      <Text className="text-sm text-muted-foreground">
        1 = a regular adult portion
      </Text>
    </View>
  );
}
