import React, { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetDashboardToday, useGetDashboardAlerts, useListHandoverNotes } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  FileText, Activity, Utensils, Baby, Weight, Bath,
  Briefcase, AlertTriangle, ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

// ---- Stat card ----
function StatCard({
  title, value, unit, icon: Icon, iconBg, iconColor, action, href,
}: {
  title: string; value?: number; unit: string; icon: React.ElementType;
  iconBg: string; iconColor: string; action: string; href: string;
}) {
  return (
    <Link href={href} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-500 font-medium leading-tight">{title}</p>
        <div className={`${iconBg} p-2 rounded-xl shrink-0`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">
        {value ?? <span className="text-gray-300 text-2xl">—</span>}
        <span className="text-base font-semibold text-gray-500 ml-1">{unit}</span>
      </p>
      <span className="flex items-center gap-0.5 text-xs text-primary font-medium">
        {action} <ChevronRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

// ---- Shortcut button ----
function ShortcutBtn({
  label, icon: Icon, bg, color, href,
}: {
  label: string; icon: React.ElementType; bg: string; color: string; href: string;
}) {
  return (
    <Link href={href} className={`${bg} rounded-xl py-4 px-2 flex flex-col items-center gap-2 hover:opacity-90 active:scale-95 transition-all`}>
      <Icon className={`h-6 w-6 ${color}`} />
      <span className={`text-[11px] font-semibold ${color} text-center leading-tight`}>{label}</span>
    </Link>
  );
}

// ---- Format time ----
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---- Dashboard ----
export default function Dashboard() {
  const { data: today } = useGetDashboardToday();
  const { data: alerts } = useGetDashboardAlerts();
  const { data: notes } = useListHandoverNotes({ today_only: false });

  const recentNotes = notes?.slice(0, 8) ?? [];
  const [activeTab, setActiveTab] = useState<"すべて" | "未対応" | "対応中" | "完了">("すべて");

  const tabs = ["すべて", "未対応", "対応中", "完了"] as const;
  const tabCounts: Record<string, number> = {
    "すべて": recentNotes.length,
    "未対応": recentNotes.filter((n: any) => !n.isImportant && n.status !== "対応中" && n.status !== "完了").length,
    "対応中": recentNotes.filter((n: any) => n.status === "対応中").length,
    "完了": recentNotes.filter((n: any) => n.status === "完了").length,
  };

  const filteredNotes = activeTab === "すべて"
    ? recentNotes
    : activeTab === "未対応"
    ? recentNotes.filter((n: any) => !n.isImportant && n.status !== "対応中" && n.status !== "完了")
    : recentNotes.filter((n: any) => n.status === activeTab);

  const vitalAlerts: any[] = alerts?.vitalAlerts ?? [];
  const elimAlerts: any[] = alerts?.eliminationAlerts ?? [];
  const hasAlerts = vitalAlerts.length > 0 || elimAlerts.length > 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ---- Stats row ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="本日の申し送り" value={today?.handoverCount} unit="件"
            icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            action="一覧を見る" href="/handover"
          />
          <StatCard
            title="バイタル未記録" value={today?.vitalsMissingCount} unit="名"
            icon={Activity} iconBg="bg-red-50" iconColor="text-red-500"
            action="記録する" href="/vitals"
          />
          <StatCard
            title="食事未記録（昼）" value={today?.mealsMissingCount} unit="名"
            icon={Utensils} iconBg="bg-orange-50" iconColor="text-orange-500"
            action="記録する" href="/meals"
          />
          <StatCard
            title="排泄未確認" value={today?.eliminationAlertCount} unit="名"
            icon={Baby} iconBg="bg-blue-50" iconColor="text-blue-500"
            action="確認する" href="/eliminations"
          />
        </div>

        {/* ---- Shortcuts (mobile: before alerts/list; desktop: right column) ---- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:hidden">
          <h2 className="font-bold text-gray-800 text-sm mb-3">今日の記録ショートカット</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <ShortcutBtn label="バイタル記録" icon={Activity} bg="bg-red-50" color="text-red-500" href="/vitals" />
            <ShortcutBtn label="食事記録（昼）" icon={Utensils} bg="bg-orange-50" color="text-orange-500" href="/meals" />
            <ShortcutBtn label="排泄確認" icon={Baby} bg="bg-blue-50" color="text-blue-500" href="/eliminations" />
            <ShortcutBtn label="入浴報告" icon={Bath} bg="bg-cyan-50" color="text-cyan-600" href="/bath-reports" />
            <ShortcutBtn label="体重記録" icon={Weight} bg="bg-green-50" color="text-green-600" href="/weights" />
            <ShortcutBtn label="デイ準備物" icon={Briefcase} bg="bg-purple-50" color="text-purple-600" href="/day-services" />
          </div>
        </div>

        {/* ---- Alert strip ---- */}
        {hasAlerts && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-1.5 text-red-600 font-semibold text-sm min-w-0">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">アラート（再測定・確認が必要な項目）</span>
              </div>
              <Link href="/vitals" className="shrink-0 text-xs text-primary font-medium flex items-center gap-0.5 hover:text-primary/80">
                すべて見る <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {vitalAlerts.map((a: any) => (
                <div key={a.residentId} className="shrink-0 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5 min-w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-bold text-red-700">{a.residentName}</span>
                  </div>
                  <p className="text-xs text-red-600">
                    {a.latestVital ? `体温 ${a.latestVital.temperature}℃` : "バイタル再測定"}
                  </p>
                  {a.latestVital?.recordedAt && (
                    <p className="text-xs text-gray-400">{fmtTime(a.latestVital.recordedAt)}</p>
                  )}
                </div>
              ))}
              {elimAlerts.map((a: any) => (
                <div key={`e-${a.residentId}`} className="shrink-0 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5 min-w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-bold text-red-700">{a.residentName}</span>
                  </div>
                  <p className="text-xs text-red-600">
                    {a.daysSinceLastBm !== null ? `排便 ${a.daysSinceLastBm}日経過` : "排便記録なし"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Bottom grid (desktop: 2-col; mobile: single col) ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ---- 申し送り section ---- */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-sm">本日の申し送り</h2>
              <Link href="/handover" className="text-xs text-primary font-medium flex items-center gap-0.5 hover:text-primary/80">
                すべて見る <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-4 overflow-x-auto scrollbar-none">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === t
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t}
                  {tabCounts[t] > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === t ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}`}>
                      {tabCounts[t]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Note list */}
            <div className="flex-1 divide-y divide-gray-50">
              {filteredNotes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">データがありません</p>
              ) : (
                filteredNotes.slice(0, 6).map((note: any) => (
                  <Link key={note.id} href={`/handover/${note.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <StatusBadge status={note.status} isImportant={note.isImportant} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {note.residentName && (
                        <span className="text-xs font-semibold text-gray-700 mr-1.5">{note.residentName}</span>
                      )}
                      <span className="text-xs text-gray-600 line-clamp-2">{note.content}</span>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                      {fmtTime(note.recordedAt)}
                    </span>
                  </Link>
                ))
              )}
            </div>

            {filteredNotes.length > 6 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <Link href="/handover" className="flex items-center justify-center gap-1 text-xs text-primary font-medium hover:text-primary/80">
                  もっと見る <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* ---- Shortcuts (desktop only — mobile version is shown above) ---- */}
          <div className="hidden lg:flex bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-col gap-4">
            <h2 className="font-bold text-gray-800 text-sm">今日の記録ショートカット</h2>
            <div className="grid grid-cols-2 gap-3">
              <ShortcutBtn label="バイタル記録" icon={Activity} bg="bg-red-50" color="text-red-500" href="/vitals" />
              <ShortcutBtn label="食事記録（昼）" icon={Utensils} bg="bg-orange-50" color="text-orange-500" href="/meals" />
              <ShortcutBtn label="排泄確認" icon={Baby} bg="bg-blue-50" color="text-blue-500" href="/eliminations" />
              <ShortcutBtn label="入浴報告" icon={Bath} bg="bg-cyan-50" color="text-cyan-600" href="/bath-reports" />
              <ShortcutBtn label="体重記録" icon={Weight} bg="bg-green-50" color="text-green-600" href="/weights" />
              <ShortcutBtn label="デイ準備物" icon={Briefcase} bg="bg-purple-50" color="text-purple-600" href="/day-services" />
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
