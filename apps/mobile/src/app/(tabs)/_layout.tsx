import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";

import { SignIn } from "@/components/sign-in";
import { useAuth } from "@/db/provider";

type IconName = Parameters<typeof SymbolView>[0]["name"];

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <SymbolView name={name} tintColor={color} size={24} />;
  };
}

export default function TabsLayout() {
  const { session, ready } = useAuth();

  if (!ready) return null;
  if (!session) return <SignIn />;

  return (
    <Tabs>
      <Tabs.Screen
        name="meals"
        options={{
          title: "Meals",
          // Nested native stack provides the large-title header.
          headerShown: false,
          tabBarIcon: tabIcon({
            ios: "fork.knife",
            android: "restaurant",
            web: "restaurant",
          }),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: tabIcon({
            ios: "house.fill",
            android: "home_filled",
            web: "home_filled",
          }),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          // Nested native stack provides the large-title header.
          headerShown: false,
          tabBarIcon: tabIcon({
            ios: "cart.fill",
            android: "shopping_cart",
            web: "shopping_cart",
          }),
        }}
      />
      <Tabs.Screen
        name="cookbook"
        options={{
          title: "Cookbook",
          headerShown: false,
          tabBarIcon: tabIcon({
            ios: "book.fill",
            android: "menu_book",
            web: "menu_book",
          }),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: tabIcon({
            ios: "ellipsis",
            android: "more_horiz",
            web: "more_horiz",
          }),
        }}
      />
    </Tabs>
  );
}
