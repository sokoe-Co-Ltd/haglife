import React, { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListHandoverNotes,
  useUpdateHandoverNote,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Stethoscope, Plus, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { DayNav, MonthNav } from "@/components/date-nav";
import { StaffMemoCard, InfoCard } from "@/components/PageRightPanel";

type Tab = "未対応" | "完了" | "すべて";
type ViewMode = "day" | "month";

function StatusToggleBtn({
  noteId,
  status,
  onDone,
}: {
  noteId: number;
  status: string;
  onDone: () => void;
}) {
  const mutation = useUpdateHandoverNote();
  const isDone = status === "完了";

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = isDone ? "未対応" : "完了";
    mutation.mutate({ id: noteId, data: { status: next } }, { onSuccess: onDone });
  }

  return (
    <button
      onClick={toggle}
      disabled={mutation.isPending}
      className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
        isDone
          ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
          : "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
      } ${mutation.isPending ? "opacity-50" : ""}`}
      title="ステータスを切り替える"
    >
      {isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      {isDone ? "完了" : "未対応"}
    </button>
  );
}

function NoteRow({ note, onStatusChange }: { note: any; onStatusChange: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <Link href={`/handover/${note.id}`} className="block">
          <div className="flex items-center gap-2 mb-1">
            {note.residentName && (
              <Link
                href={`/residents/${note.residentId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-bold text-primary hover:underline"
              >
                {note.residentName}
              </Link>
            )}
            <span className="text-xs text-gray-500">{note.category}</span>
            {note.isDoctorReport && (
              <span className="inline-flex items-center gap-0.5 text-xs text-blue-600">
                <Stethoscope className="h-3 w-3" />医療
              </span>
            )}
            {note.isImportant && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">重要</span>
            )}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{note.content}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-400">{note.authorName}</span>
            <span className="text-xs text-gray-400">
              {format(new Date(note.recordedAt), "HH:mm", { locale: ja })}
            </span>
          </div>
        </Link>
      </div>
      <div className="shrink-0 mt-0.5">
        <StatusToggleBtn noteId={note.id} status={note.status} onDone={onStatusChange} />
      </div>
    </div>
  );
}

export default function HandoverList() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [date, setDate] = useState(new Date());
  const [monthYear, setMonthYear] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [activeTab, setActiveTab] = useState<Tab>("未対応");

  const queryClient = useQueryClient();

  const dateStr = format(date, "yyyy-MM-dd");
  const yearMonthStr = `${monthYear.year}-${String(monthYear.month).padStart(2, "0")}`;

  const queryParams = viewMode === "day"
    ? { date: dateStr, limit: 200 }
    : { year_month: yearMonthStr, limit: 500 };

  const { data: notes, isLoading } = useListHandoverNotes(queryParams);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/handover-notes"] });
  }

  const tabs: Tab[] = ["未対応", "完了", "すべて"];

  const filtered = (notes ?? []).filter((n: any) => {
    if (activeTab === "すべて") return true;
    if (activeTab === "未対応") return n.status !== "完了";
    return n.status === "完了";
  });

  const tabCounts: Record<Tab, number> = {
    "未対応": (notes ?? []).filter((n: any) => n.status !== "完了").length,
    "完了": (notes ?? []).filter((n: any) => n.status === "完了").length,
    "すべて": notes?.length ?? 0,
  };

  // Month view: group filtered notes by date
  type GroupedNotes = { dateLabel: string; notes: any[] }[];
  const groupedByDate: GroupedNotes = [];
  if (viewMode === "month") {
    const map = new Map<string, any[]>();
    for (const n of filtered) {
      const key = format(new Date(n.recordedAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    for (const [key, arr] of Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
      groupedByDate.push({
        dateLabel: format(new Date(key), "M月d日（E）", { locale: ja }),
        notes: arr,
      });
    }
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800">
            申し送り
            {notes && <span className="ml-2 text-sm font-normal text-gray-500">（{notes.length}件）</span>}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
              <button
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 transition-colors ${viewMode === "day" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                日
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${viewMode === "month" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"}`}
              >
                月
              </button>
            </div>

            {/* Date/month nav */}
            {viewMode === "day" ? (
              <DayNav date={date} onChange={setDate} />
            ) : (
              <MonthNav year={monthYear.year} month={monthYear.month} onChange={(y, m) => setMonthYear({ year: y, month: m })} />
            )}

            <Link href="/handover/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                新規作成
              </Button>
            </Link>
          </div>
        </div>

        {/* PC: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          {/* Main content */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-4">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === t
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t}
                  {tabCounts[t] > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === t ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>
                      {tabCounts[t]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : viewMode === "day" ? (
              filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  {activeTab === "すべて" ? "この日の申し送りはありません" : `${activeTab}の申し送りはありません`}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filtered.map((note: any) => (
                    <NoteRow key={note.id} note={note} onStatusChange={invalidate} />
                  ))}
                </div>
              )
            ) : (
              groupedByDate.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  {activeTab === "すべて" ? "この月の申し送りはありません" : `${activeTab}の申し送りはありません`}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {groupedByDate.map(({ dateLabel, notes: dayNotes }) => (
                    <div key={dateLabel}>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-500">{dateLabel}</span>
                        <span className="ml-2 text-xs text-gray-400">{dayNotes.length}件</span>
                      </div>
                      {dayNotes.map((note: any) => (
                        <NoteRow key={note.id} note={note} onStatusChange={invalidate} />
                      ))}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <InfoCard title="対応状況">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-sm text-gray-600">未対応</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{tabCounts["未対応"]}件</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400 shrink-0" />
                    <span className="text-sm text-gray-600">完了</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{tabCounts["完了"]}件</span>
                </div>
              </div>
            </InfoCard>

            <StaffMemoCard memo="重要な申し送りは必ず確認し、対応状況を更新してください。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
