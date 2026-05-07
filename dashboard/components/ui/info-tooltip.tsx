"use client";

interface InfoTooltipProps {
  content: React.ReactNode;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center group ml-1 cursor-help align-middle">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] text-muted-foreground hover:border-foreground/60 hover:text-foreground transition-colors">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {content}
      </span>
    </span>
  );
}
