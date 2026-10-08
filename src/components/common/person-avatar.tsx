import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-neutral-900 text-white dark:bg-neutral-200 dark:text-neutral-900",
  "bg-brand/90 text-white",
  "bg-neutral-600 text-white",
  "bg-info/85 text-white",
  "bg-success/85 text-white",
  "bg-violet/85 text-white",
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PersonAvatar({
  name,
  trial,
  size = "md",
  className,
}: {
  name: string;
  trial?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-7 text-[0.65rem]", md: "size-9 text-xs", lg: "size-14 text-lg" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none",
        trial
          ? "bg-warning/20 text-[color-mix(in_oklch,var(--warning),black_35%)] ring-1 ring-warning/50 ring-dashed dark:text-warning"
          : PALETTE[hash(name) % PALETTE.length],
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Vista previa compacta de asistentes (pila de iniciales + contador). */
export function AvatarStack({
  people,
  max = 5,
}: {
  people: Array<{ id: string; fullName: string; type: "client" | "trial" }>;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        <PersonAvatar
          key={p.id}
          name={p.fullName}
          trial={p.type === "trial"}
          size="sm"
          className="ring-2 ring-card"
        />
      ))}
      {rest > 0 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[0.65rem] font-semibold text-muted-foreground ring-2 ring-card">
          +{rest}
        </span>
      )}
    </div>
  );
}
