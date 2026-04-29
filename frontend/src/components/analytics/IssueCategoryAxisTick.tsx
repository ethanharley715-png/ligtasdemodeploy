type IssueCategoryAxisTickProps = {
  x?: number;
  y?: number;
  payload?: {
    value?: string;
  };
};

function splitLabel(value: string): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return [value];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")].filter(Boolean);
}

export function IssueCategoryAxisTick({ x = 0, y = 0, payload }: IssueCategoryAxisTickProps) {
  const value = payload?.value?.trim() || "";
  const lines = splitLabel(value);

  return (
    <g transform={`translate(${x},${y})`}>
      <text y={14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={12}>
        {lines.map((line, index) => (
          <tspan key={`${value}-${index}`} x={0} dy={index === 0 ? 0 : 14}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
