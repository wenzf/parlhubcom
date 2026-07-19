import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { cn } from "~/lib/std/cn"

// Single-select segmented control (styled Base UI ToggleGroup). The elegant
// replacement for a row of outlined toggle buttons: a quiet track (bg-muted),
// inactive items ghost/muted, the active item lifted with bg-background + a
// hairline ring + soft shadow. Concentric radii (track md › item sm), inset
// focus so it isn't clipped inside a framed panel. `size="sm"` for dense panels
// (>=24px AA floor); default is the 44px standalone target.
//
//   <Segmented value={scale} onValueChange={setScale}>
//     <SegmentedItem value="log">Log</SegmentedItem>
//     <SegmentedItem value="linear">Linear</SegmentedItem>
//   </Segmented>
function Segmented({
  value,
  onValueChange,
  size = "default",
  className,
  ...props
}: Omit<ToggleGroupPrimitive.Props, "value" | "onValueChange" | "defaultValue"> & {
  value: string
  onValueChange: (value: string) => void
  size?: "default" | "sm"
}) {
  return (
    <ToggleGroupPrimitive
      data-slot="segmented"
      data-size={size}
      value={[value]}
      onValueChange={(vals) => {
        const next = vals[vals.length - 1]
        if (next && next !== value) onValueChange(next) // ignore click on the active item (no deselect)
      }}
      className={cn(
        // Always 44px tall (AAA target) — `size="sm"` only trims item padding/font, never the height.
        "inline-flex h-11 w-fit items-center gap-0.5 rounded-md border border-input bg-muted/40 p-0.5",
        className
      )}
      {...props}
    />
  )
}

function SegmentedItem({
  className,
  ...props
}: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="segmented-item"
      className={cn(
        "inline-flex h-full min-w-9 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-sm data-pressed:ring-1 data-pressed:ring-foreground/10 in-data-[size=sm]:px-2 in-data-[size=sm]:text-xs [&_svg:not([class*='size-'])]:size-4 in-data-[size=sm]:[&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem }
