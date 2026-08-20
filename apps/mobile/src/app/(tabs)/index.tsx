import { Text, View } from "react-native";

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center gap-1 bg-background">
      <Text className="text-lg font-semibold text-foreground">Home</Text>
      <Text className="text-sm text-muted-foreground">Coming soon.</Text>
    </View>
  );
}
