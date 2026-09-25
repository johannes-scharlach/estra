import { Stack } from "expo-router";

// A group, not an "index" folder: its index still serves "/", and the
// stack's own "index" screen no longer nests under a screen of that name.
export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Home",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
