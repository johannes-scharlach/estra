import { cn } from "@/lib/utils";
import { OTPInput, type OTPInputProps, type OTPInputRef } from "input-otp-native";
import { type Ref } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

function InputOTP({
  className,
  invalid,
  ...props
}: Omit<OTPInputProps, "render"> & { className?: string; invalid?: boolean; ref?: Ref<OTPInputRef> }) {
  return (
    <OTPInput
      clearTextOnFocus={false}
      render={({ slots }) => (
        <View className={cn("flex-row justify-between gap-2", className)}>
          {slots.map((slot, index) => (
            <Pressable
              key={index}
              onPress={slot.focus}
              className={cn(
                "bg-card min-h-14 flex-1 items-center justify-center rounded-xl border border-border py-3",
                slot.isActive && "border-ring",
                invalid && "border-destructive",
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
