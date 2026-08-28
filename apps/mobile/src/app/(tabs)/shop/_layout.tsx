import { Stack } from "expo-router";

export default function ShopLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Shop",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
