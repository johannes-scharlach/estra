import { cn } from "@/lib/utils";
import { TextInput } from "react-native";
import { useState } from "react";
import { useResolveClassNames } from "uniwind";

// NOTE: uniwind has no placeholderClassName (that's NativeWind-only), and the
// placeholder: variant does nothing on native (the placeholder falls back to
// black), so the colour is resolved from the theme and passed explicitly.
function Input({
  className,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      className={cn(
        "bg-card text-foreground flex min-h-12 w-full min-w-0 rounded-xl border border-border px-3 py-3 text-base leading-5",
        focused && "border-primary",
        props.editable === false && "opacity-50",
        className,
      )}
      placeholderTextColor={placeholderColor}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}

export { Input };
