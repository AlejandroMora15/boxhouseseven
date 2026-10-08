import { cn } from "@/lib/utils";

/** Marca "7" del logo de Boxhouseseven (vectorizada, hereda el color). */
export function LogoMark({ className, title = "Boxhouseseven" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 346 291"
      role="img"
      aria-label={title}
      className={cn("h-6 w-auto fill-current", className)}
    >
      <polygon points="0,0 346,0 173,291 130,223 221,70 43,70" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span className="text-[0.82rem] font-medium tracking-[0.28em] whitespace-nowrap">BOXHOUSESEVEN</span>
      )}
    </span>
  );
}
