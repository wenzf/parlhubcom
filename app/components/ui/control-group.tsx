import * as React from "react"

import { cn } from "~/lib/std/cn"

// Grouped settings/controls list — the elegant default for any panel of
// label→control rows (see docs/styleguide.md §6 "Grouped lists"). Related controls
// sit in one inset card divided by hairlines; the card supplies the boundary so
// the controls inside can go ghost. Concentric radii: put this inside a panel
// with a larger radius (popover rounded-xl › card rounded-lg › control md).
//
//   <ControlGroup label="Appearance">
//     <ControlRow label="Scale"><Segmented …/></ControlRow>
//     <ControlRow label="Interactive" asLabel><Switch …/></ControlRow>
//     <ControlRow label="Theme" bleed><Select><SelectTrigger className={ghostSelectTrigger}/>…</Select></ControlRow>
//   </ControlGroup>
function ControlGroup({
  label,
  className,
  children,
}: {
  /** Quiet section label shown above the card. */
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <p className="px-1 text-xs font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div
        data-slot="control-group"
        className={cn(
          "divide-y divide-border overflow-hidden rounded-lg border border-border bg-card",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ControlRow({
  label,
  children,
  bleed = false,
  asLabel = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode
  /** Render as a <label> so the whole row toggles its control (switch/checkbox rows). */
  asLabel?: boolean
  /** Trailing control's hover surface bleeds to the frame — pairs with a
   *  `rounded-r-none` ghost control so no sliver shows (see ghostSelectTrigger). */
  bleed?: boolean
}) {
  const Comp = (asLabel ? "label" : "div") as React.ElementType
  return (
    <Comp
      data-slot="control-row"
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 pl-3 pr-0",
        asLabel && "cursor-pointer",
        className
      )}
      {...props}
    >
      <span className="text-sm">{label}</span>
      {children}
    </Comp>
  )
}

// Ghost <SelectTrigger> for a bleed row inside a ControlGroup: the card border
// is the boundary, so the trigger drops its own border/fill and reads as value +
// chevron. Trailing corner squared + inset focus so the card's clip renders the
// hover flush to the frame. Pair with <ControlRow bleed>.
const ghostSelectTrigger =
  "w-auto gap-1.5 rounded-r-none border-transparent bg-transparent px-2.5 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:ring-inset focus-visible:ring-offset-0 dark:bg-transparent dark:hover:bg-muted"

// Ghost native <input type="date"> for a bleed row inside a ControlGroup. Same
// border-first idea as ghostSelectTrigger: the card supplies the boundary, so the
// field drops its own box and reads as value + native picker glyph. Trailing corner
// squared + inset focus so the card's overflow-hidden clip renders it flush. Pair
// with <ControlRow bleed>.
const ghostDateField =
  "h-11 rounded-l-md rounded-r-none border-transparent bg-transparent px-2.5 text-sm text-muted-foreground shadow-none outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:ring-offset-0 dark:bg-transparent dark:hover:bg-muted"

export { ControlGroup, ControlRow, ghostSelectTrigger, ghostDateField }
