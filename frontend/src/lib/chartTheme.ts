/**
 * Theme tokens for Recharts — uses CSS variables from `index.css` so charts respect light/dark.
 */
export const LIGTAS_CHART = {
  gridStroke: "hsl(var(--border))",
  axisTick: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
  tooltip: {
    contentStyle: {
      backgroundColor: "hsl(var(--popover))",
      color: "hsl(var(--popover-foreground))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px",
      fontSize: "12px",
    },
    wrapperStyle: { outline: "none" as const },
  },
  linePrimary: "hsl(var(--primary))",
  lineSecondary: "hsl(var(--muted-foreground))",
  lineAccent: "hsl(var(--chart-accent))",
  barFill: "hsl(var(--primary))",
} as const;
