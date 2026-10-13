import { shopAccessOptions, type CookingProfile, type Shop } from "@magpie/profile";
import { useRef, useState } from "react";
import { Pressable, View, type TextInput } from "react-native";
import { PrimaryAction } from "@/components/action";
import { EditorSheet } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { Field } from "@/features/profile/form";

export function ShopsEditor({ profile, onChange }: {
  profile: CookingProfile;
  onChange: (changes: Partial<CookingProfile>) => void;
}) {
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
  return (
    <View className="gap-7">
      <Field label="Main shop" value={profile.main_supermarket} onChangeText={(main_supermarket) => onChange({ main_supermarket })} placeholder="e.g. Aldi, Rewe, Tesco" returnKeyType="done" />
      <View className="gap-3">
        <Text className="text-lg font-semibold">Other shops</Text>
        {profile.shops.map((shop, index) => (
          <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Edit ${shop.name}, ${shopAccessOptions[shop.access]}`} className="min-h-16 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3" onPress={() => open(shop, index)}>
            <View className="flex-1 gap-1"><Text className="font-medium">{shop.name}</Text><Text className="text-sm text-muted-foreground">{shopAccessOptions[shop.access]}</Text></View>
            <Text className="text-sm text-primary">Edit</Text>
          </Pressable>
        ))}
        {!profile.shops.length ? (
          <View className="flex-row flex-wrap gap-2">
            {["Asian grocer", "Market", "Butcher"].map((name) => <Pressable key={name} accessibilityRole="button" className="min-h-11 justify-center rounded-full border border-border bg-card px-4 py-2" onPress={() => open({ name, access: "easy" })}><Text>{name}</Text></Pressable>)}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" className="min-h-11 justify-center self-start" onPress={() => open({ name: "", access: "easy" })}><Text className="font-medium text-primary">+ Add a shop</Text></Pressable>
      </View>
      {profile.other_shops ? <Field label="Your existing shopping notes" multiline value={profile.other_shops} onChangeText={(other_shops) => onChange({ other_shops })} /> : null}
      {editing ? (
        <EditorSheet title={editing.index < 0 ? "Add a shop" : "Edit shop"} onDismiss={() => setEditing(null)}>
          <Field ref={input} label="Shop name" value={editing.shop.name} onChangeText={(name) => setEditing({ ...editing, shop: { ...editing.shop, name } })} autoFocus={!editing.shop.name} error={attempted && !editing.shop.name.trim() ? "Enter a shop name." : null} />
          <Text className="font-medium">How easy is it to get there?</Text>
          <View className="gap-2">
            {(Object.entries(shopAccessOptions) as [Shop["access"], string][]).map(([access, label]) => (
              <Pressable key={access} accessibilityRole="radio" accessibilityState={{ checked: editing.shop.access === access }} className={editing.shop.access === access ? "min-h-14 flex-row items-center justify-between rounded-xl border border-primary bg-accent px-4 py-3" : "min-h-14 justify-center rounded-xl border border-border bg-card px-4 py-3"} onPress={() => setEditing({ ...editing, shop: { ...editing.shop, access } })}>
                <Text className="font-medium">{label}</Text>{editing.shop.access === access ? <Text className="text-primary">✓</Text> : null}
              </Pressable>
            ))}
          </View>
          <PrimaryAction label={editing.index < 0 ? "Add shop" : "Save"} onPress={save} />
          {editing.index >= 0 ? <Pressable accessibilityRole="button" className="min-h-11 items-center justify-center" onPress={() => { onChange({ shops: profile.shops.filter((_, index) => index !== editing.index) }); setEditing(null); }}><Text className="font-medium text-destructive">Remove shop</Text></Pressable> : null}
        </EditorSheet>
      ) : null}
    </View>
  );
}
