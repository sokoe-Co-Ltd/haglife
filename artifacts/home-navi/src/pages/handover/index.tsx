import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHandoverNotes } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Stethoscope, Plus, ChevronRight, Filter, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { DayNav } from "@/components/date-nav";
import { StatusBadge } from "@/components/StatusBadge";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";

type Tab = "すべて" | "未対応" | "対応中" | "完了";

export default function HandoverList() {
  const [date, setDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<Tab>("すべて");
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: notes, isLoading } = useListHandoverNotes({ date: dateStr });

  const tabs: Tab[] = ["すべて", "未対応", "対応中", "完了"];
  const tabCounts: Record<Tab, number> = {
    "すべて": notes?.length ?? 0,
    "未対応": notes?.filter((n: any) => !n.isImportant && n.status !== "対応中" && n.status !== "完了").length ?? 0,
    "対応中": notes?.filter((n: any) => n.status === "対応中").length ?? 0,
    "完了": notes?.filter((n: any) => n.status === "完了").length ?? 0,
  };

  const filtered = activeTab === "すべて"
    ? notes ?? []
    : activeTab === "未対応"
    ? (notes ?? []).filter((n: any) => !n.isImportant && n.status !== "対応中" && n.status !== "完了")
    : (notes ?? []).filter((n: any) => n.status === activeTab);

  const quickActions = [
    { label: "新規作成", icon: Plus, href: "/handover/new", color: "bg-primary" },
    { label: "未対応のみ表示", icon: Filter },
    { label: "日付カレンダー", icon: Calendar },
    { label: "履歴エクスポート", icon: Download },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800">
            申し送り
            {notes && <span className="ml-2 text-sm font-normal text-gray-500">（{notes.length}件）</span>}
          </h1>
          <div className="flex items-center gap-2">
            <DayNav date={date} onChange={setDate} />
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
              <div className="space-y-0 divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">この日の申し送りはありません</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((note: any) => (
                  <Link key={note.id} href={`/handover/${note.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <StatusBadge status={note.status} isImportant={note.isImportant} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {note.residentName && (
                          <span className="text-sm font-bold text-gray-800">{note.residentName}</span>
                        )}
                        <span className="text-xs text-gray-500">{note.category}</span>
                        {note.isDoctorReport && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-blue-600">
                            <Stethoscope className="h-3 w-3" />医療
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{note.content}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-gray-400">{note.authorName}</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(note.recordedAt), "HH:mm", { locale: ja })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 mt-1 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <QuickActionsCard actions={quickActions} />

            <InfoCard title="対応状況">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-sm text-gray-600">未対応</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{tabCounts["未対応"]}件</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-sm text-gray-600">対応中</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{tabCounts["対応中"]}件</span>
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
