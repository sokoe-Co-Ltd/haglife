import { cn } from "@/lib/utils";

export type AuditAxis = "staff" | "resident";

export function AxisTabs({ value, onChange }: { value: AuditAxis; onChange: (v: AuditAxis) => void }) {
  return (
    <div className="flex gap-1 border-b">
      {(["staff", "resident"] as const).map((axis) => (
        <button
          key={axis}
          onClick={() => onChange(axis)}
          className={cn(
            "text-sm px-4 py-2 border-b-2 -mb-px transition-colors",
            value === axis
              ? "border-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {axis === "staff" ? "ヘルパー軸" : "利用者軸"}
        </button>
      ))}
    </div>
  );
}
