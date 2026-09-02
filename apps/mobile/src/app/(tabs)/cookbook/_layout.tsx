import { Stack } from "expo-router";

export default function CookbookLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Cookbook",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
