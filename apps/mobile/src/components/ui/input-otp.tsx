import { cn } from "@/lib/utils";
import { OTPInput, type OTPInputProps } from "input-otp-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

function InputOTP({
  className,
  ...props
}: Omit<OTPInputProps, "render"> & { className?: string }) {
  return (
    <OTPInput
      render={({ slots }) => (
        <View className={cn("flex-row justify-between gap-2", className)}>
          {slots.map((slot, index) => (
            <Pressable
              key={index}
              onPress={slot.focus}
              className={cn(
                "bg-muted h-14 flex-1 items-center justify-center rounded-xl border-2 border-transparent",
                slot.isActive && "border-ring",
              )}
            >
              <Text className="text-xl font-medium">
                {slot.char ?? (slot.hasFakeCaret ? "|" : "")}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {...props}
    />
  );
}

export { InputOTP };
