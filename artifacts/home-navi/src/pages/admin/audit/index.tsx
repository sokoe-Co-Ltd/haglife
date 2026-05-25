import { useState } from "react";
import { format, addDays, parseISO, isValid } from "date-fns";
import { Layout } from "@/components/layout";
import { useAppDate } from "@/contexts/AppDateContext";
import { useGetAuditRouteSheet } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Legend } from "./components/Legend";
import { AxisTabs, type AuditAxis } from "./components/AxisTabs";
import { AuditGantt } from "./components/AuditGantt";
import { NotificationPanel } from "./components/NotificationPanel";

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export default function AuditDashboardPage() {
  const { appDate } = useAppDate();
  const today = format(appDate, "yyyy-MM-dd");
  const [date, setDate] = useState<string>(today);
  const [axis, setAxis] = useState<AuditAxis>("staff");

  const { data, isLoading } = useGetAuditRouteSheet(date);
  const cells = data?.cells ?? [];

  // 7日タブ: today を中心に -3..+3
  const dayTabs = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(parseISO(today), i - 3);
    return format(d, "yyyy-MM-dd");
  });

  const parsedDate = parseISO(date);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg md:text-xl font-medium">監査ビュー</h1>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              if (v && isValid(parseISO(v))) setDate(v);
            }}
            className="text-sm border rounded px-2 py-1 bg-background"
          />
        </div>

        {/* 曜日タブ */}
        <div className="flex gap-1 overflow-x-auto">
          {dayTabs.map((d) => {
            const dt = parseISO(d);
            const active = d === date;
            const isToday = d === today;
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={cn(
                  "shrink-0 px-3 py-1.5 text-xs rounded-md border transition-colors",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background hover:bg-muted",
                  isToday && !active && "ring-1 ring-foreground/30",
                )}
              >
                {format(dt, "M/d")}（{DAY_NAMES[dt.getDay()]}）
              </button>
            );
          })}
        </div>

        <AxisTabs value={axis} onChange={setAxis} />
        <Legend />

        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">読み込み中…</div>
        ) : (
          <AuditGantt cells={cells} date={date} axis={axis} />
        )}

        <NotificationPanel date={date} />

        <div className="text-xs text-muted-foreground">
          {format(parsedDate, "yyyy年M月d日")}（{DAY_NAMES[parsedDate.getDay()]}） ・ 全 {cells.length} 件
        </div>
      </div>
    </Layout>
  );
}
