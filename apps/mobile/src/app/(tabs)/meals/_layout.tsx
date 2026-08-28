import { Stack } from "expo-router";

export default function MealsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Meals",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
