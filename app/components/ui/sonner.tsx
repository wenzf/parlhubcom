import { useRouteLoaderData } from "react-router"
import { Toaster as Sonner } from "sonner"

// shadcn "sonner" recipe, adapted to parlhub: theme is not sourced from
// next-themes (unused here) but from the root loader `settings.theme`
// ('light' | 'dark' | 'system'), the same value that classes <html> in root.tsx.
// Toasts inherit the app's monochrome tokens via the CSS-variable bridge below,
// so they read as `bg-popover` cards with the standard ring/shadow (§8).
function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
    const rootData = useRouteLoaderData("root") as
        { settings?: { theme?: "light" | "dark" | "system" } } | undefined
    const theme = rootData?.settings?.theme ?? "system"

    return (
        <Sonner
            theme={theme}
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-popover group-[.toaster]:text-foreground group-[.toaster]:rounded-xl group-[.toaster]:border-0 group-[.toaster]:ring-1 group-[.toaster]:ring-foreground/10 group-[.toaster]:shadow-lg",
                    description: "group-[.toast]:text-muted-foreground",
                    // AAA (WCAG 2.5.5): toast buttons are real 44px targets with a
                    // visible focus ring (§2), not sonner's sub-44 default chips.
                    actionButton:
                        "group-[.toast]:min-h-11 group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/80 group-[.toast]:focus-visible:ring-2 group-[.toast]:focus-visible:ring-ring group-[.toast]:focus-visible:ring-offset-2 group-[.toast]:focus-visible:ring-offset-popover",
                    cancelButton:
                        "group-[.toast]:min-h-11 group-[.toast]:rounded-md group-[.toast]:px-3 group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:focus-visible:ring-2 group-[.toast]:focus-visible:ring-ring group-[.toast]:focus-visible:ring-offset-2 group-[.toast]:focus-visible:ring-offset-popover",
                },
            }}
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                } as React.CSSProperties
            }
            {...props}
        />
    )
}

export { Toaster }
