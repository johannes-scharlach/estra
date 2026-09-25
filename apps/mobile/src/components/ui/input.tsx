import { cn } from "@/lib/utils";
import { Platform, TextInput } from "react-native";

// NOTE: uniwind has no placeholderClassName (that's NativeWind-only), so the
// rnr-generated prop was dropped here. Placeholder styling comes from the
// placeholder:text-muted-foreground classes in className below.
function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
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
      {...props}
    />
  );
}

export { Input };
