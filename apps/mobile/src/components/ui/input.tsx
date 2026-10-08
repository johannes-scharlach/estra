import { cn } from "@/lib/utils";
import { Platform, TextInput } from "react-native";
import { useResolveClassNames } from "uniwind";

// NOTE: uniwind has no placeholderClassName (that's NativeWind-only), and the
// placeholder: variant does nothing on native (the placeholder falls back to
// black), so the colour is resolved from the theme and passed explicitly.
function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  const placeholderColor = useResolveClassNames("text-muted-foreground").color;
  return (
    <TextInput
      className={cn(
        "bg-muted text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-xl px-3 py-1 text-base leading-5 sm:h-9",
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          ),
          native: "placeholder:text-muted-foreground/70",
        }),
        className,
      )}
      placeholderTextColor={placeholderColor}
      {...props}
    />
  );
}

export { Input };
