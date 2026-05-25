import { cn } from "@/lib/utils";

function LegendItem({ color, dot, label }: { color?: string; dot?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {color && <span className={cn("size-3 rounded-sm", color)} />}
      {dot && <span className={cn("size-2 rounded-full", dot)} />}
      {label}
    </span>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
      <LegendItem color="bg-background border border-border" label="計画通り" />
      <LegendItem color="bg-red-50 border border-red-500/60" label="未実施" />
      <LegendItem color="bg-blue-50 border border-blue-500/60" label="担当変更" />
      <LegendItem color="bg-purple-50 border border-purple-500/60" label="追加" />
      <LegendItem dot="bg-amber-500" label="変更メモあり" />
      <LegendItem dot="bg-orange-500" label="未実施・理由未入力" />
    </div>
  );
}
