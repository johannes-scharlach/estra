import { shopAccessOptions, type CookingProfile, type Shop } from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Platform, Pressable, View, type TextInput } from "react-native";
import { useResolveClassNames } from "uniwind";
import { PrimaryAction } from "@/components/action";
import { ChoiceList } from "@/components/choice-list";
import { EditorSheet } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { Field } from "@/features/profile/form";

const shopSuggestions = ["Asian grocer", "Market", "Butcher"] as const;

export function ShopsEditor({ profile, onChange }: {
  profile: CookingProfile;
  onChange: (changes: Partial<CookingProfile>) => void;
}) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const [editing, setEditing] = useState<{ index: number; shop: Shop } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const input = useRef<TextInput>(null);
  function open(shop: Shop, index = -1) { setAttempted(false); setEditing({ shop: { ...shop }, index }); }
  function save() {
    if (!editing) return;
    if (!editing.shop.name.trim()) { setAttempted(true); input.current?.focus(); return; }
    const shop = { ...editing.shop, name: editing.shop.name.trim() };
    onChange({ shops: editing.index < 0 ? [...profile.shops, shop] : profile.shops.map((entry, index) => index === editing.index ? shop : entry) });
    setEditing(null);
  }
  const remainingSuggestions = shopSuggestions.filter(
    (name) => !profile.shops.some((shop) => shop.name.toLowerCase() === name.toLowerCase()),
  );
  return (
    <View className="gap-7">
      <Field label="Main shop" value={profile.main_supermarket} onChangeText={(main_supermarket) => onChange({ main_supermarket })} placeholder="e.g. Aldi, Rewe, Tesco" returnKeyType="done" />
      <View className="gap-3">
        <Text className="text-lg font-semibold">Other shops</Text>
        {profile.shops.length ? (
          <View
            className="overflow-hidden rounded-xl border border-border bg-card"
            style={{ borderCurve: "continuous" }}
          >
            {profile.shops.map((shop, index) => (
              <View key={index}>
                {index > 0 ? (
                  <View
                    className={
                      Platform.OS === "ios"
                        ? "ml-4 border-t border-border"
                        : "border-t border-border"
                    }
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${shop.name}, ${shopAccessOptions[shop.access]}`}
                  className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
                  onPress={() => open(shop, index)}
                >
                  <View className="flex-1 gap-1">
                    <Text className="text-[17px] font-medium">{shop.name}</Text>
                    <Text className="text-sm leading-5 text-muted-foreground">
                      {shopAccessOptions[shop.access]}
                    </Text>
                  </View>
                  <SymbolView
                    name={{ ios: "chevron.right", android: "edit" }}
                    size={16}
                    tintColor={mutedColor}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View className="flex-row flex-wrap items-start gap-2">
          {remainingSuggestions.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              className="min-h-11 justify-center rounded-full border border-border bg-card px-4 py-2"
              onPress={() => open({ name, access: "easy" })}
            >
              <Text>{name}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center rounded-full border border-border bg-card px-4 py-2"
            onPress={() => open({ name: "", access: "easy" })}
          >
            <Text className="font-medium text-primary">+ Add a shop</Text>
          </Pressable>
        </View>
      </View>
      {profile.other_shops ? <Field label="Your existing shopping notes" multiline value={profile.other_shops} onChangeText={(other_shops) => onChange({ other_shops })} /> : null}
      {editing ? (
        <EditorSheet title={editing.index < 0 ? "Add a shop" : "Edit shop"} onDismiss={() => setEditing(null)}>
          <Field ref={input} label="Shop name" value={editing.shop.name} onChangeText={(name) => setEditing({ ...editing, shop: { ...editing.shop, name } })} autoFocus={!editing.shop.name} returnKeyType="done" error={attempted && !editing.shop.name.trim() ? "Enter a shop name." : null} />
          <View className="gap-2">
            <Text className="font-medium">How easy is it to get there?</Text>
            <ChoiceList
              choices={Object.entries(shopAccessOptions).map(([key, title]) => ({ key, title }))}
              selectedKeys={[editing.shop.access]}
              selection="single"
              onSelect={(access) => setEditing({ ...editing, shop: { ...editing.shop, access: access as Shop["access"] } })}
            />
          </View>
          <PrimaryAction label={editing.index < 0 ? "Add shop" : "Save"} onPress={save} />
          {editing.index >= 0 ? <Pressable accessibilityRole="button" className="min-h-11 items-center justify-center" onPress={() => { onChange({ shops: profile.shops.filter((_, index) => index !== editing.index) }); setEditing(null); }}><Text className="font-medium text-destructive">Remove shop</Text></Pressable> : null}
        </EditorSheet>
      ) : null}
    </View>
  );
}
