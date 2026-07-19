import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "~/lib/std/cn"

// On/off switch for immediate settings (WCAG APG "switch" pattern). State is
// shown by both track colour (>=3:1: bg-input off vs bg-primary on) and thumb
// position, never colour alone. The invisible ::after expands the hit area to
// the 44px AAA target even though the visual track is smaller.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-transparent bg-input outline-none transition-colors after:absolute after:-inset-x-1.5 after:-inset-y-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 translate-x-0 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-transform data-checked:translate-x-4"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
