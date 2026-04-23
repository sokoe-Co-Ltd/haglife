import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHandoverNotes } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Stethoscope, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

type Tab = "すべて" | "未対応" | "対応中" | "完了";

function StatusBadge({ status, isImportant }: { status?: string; isImportant?: boolean }) {
  if (isImportant) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">重要</span>;
  if (status === "対応中") return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-600">対応中</span>;
  if (status === "完了") return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">完了</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-orange-400 text-orange-500">未対応</span>;
}

export default function HandoverList() {
  const { data: notes, isLoading } = useListHandoverNotes();
  const [activeTab, setActiveTab] = useState<Tab>("すべて");

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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">申し送り</h1>
          <Link href="/handover/new">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
              <Plus className="h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </div>

        {/* Card with tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t}
                {tabCounts[t] > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === t ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                    {tabCounts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
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
            <div className="text-center py-16 text-gray-400">データがありません</div>
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
                        {format(new Date(note.recordedAt), "MM/dd HH:mm", { locale: ja })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 mt-1 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
