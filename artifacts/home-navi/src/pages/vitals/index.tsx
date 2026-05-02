import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetVitalsTodayStatus, useGetVitalThresholds } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertCircle, CheckCircle2, ChevronRight, Plus, Settings, FileDown } from "lucide-react";
import { Link } from "wouter";
import { DayNav } from "@/components/date-nav";
import { format } from "date-fns";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";
import { Button } from "@/components/ui/button";
import { isTodayBirthday } from "@/lib/birthday";
import { printVitalsPdf } from "@/lib/printVitalsPdf";

const SESSION_KEY = "vitals-selected-date";

function saveDate(d: Date) {
  sessionStorage.setItem(SESSION_KEY, d.toISOString());
}

function loadDate(): Date {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    const d = new Date(stored);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function ResidentVitalCard({ status, dateStr }: { status: any; dateStr: string }) {
  const needsRecheck = status.needsRecheck;
  const isRecorded = status.recordedToday;
  const isBirthday = isTodayBirthday(status.birthMonth, status.birthDay);

  return (
    <Link
      href={`/vitals/${status.residentId}?date=${dateStr}`}
      className={`flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors ${isBirthday ? "bg-red-50 hover:bg-red-50" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {needsRecheck ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
            要再測定
          </span>
        ) : isRecorded ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">
            記録済
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-primary text-primary">
            未記録
          </span>
        )}
        <div className="min-w-0">
          {isBirthday ? (
            <div className="flex flex-col gap-0.5">
              <div>
                <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
                <span className="text-sm font-semibold text-red-600">{status.residentName}様</span>
              </div>
              <span className="text-xs font-bold text-red-500">🎂 本日お誕生日</span>
            </div>
          ) : (
            <>
              <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
              <span className="text-sm font-semibold text-gray-800">{status.residentName}様</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {isRecorded && status.latestVital && (
          <div className="hidden sm:flex gap-3 text-xs text-gray-500">
            {status.latestVital.temperature != null && (
              <span>KT: <strong className={needsRecheck ? "text-red-600" : "text-gray-700"}>{status.latestVital.temperature}</strong></span>
            )}
            {status.latestVital.bpSystolic != null && (
              <span>BP: <strong className="text-gray-700">{status.latestVital.bpSystolic}/{status.latestVital.bpDiastolic}</strong></span>
            )}
            {status.latestVital.pulse != null && (
              <span>P: <strong className="text-gray-700">{status.latestVital.pulse}</strong></span>
            )}
            {status.latestVital.spo2 != null && (
              <span>SpO2: <strong className="text-gray-700">{status.latestVital.spo2}%</strong></span>
            )}
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </Link>
  );
}

export default function VitalsList() {
  const [date, setDate] = useState<Date>(loadDate);
  const dateStr = format(date, "yyyy-MM-dd");

  function handleDateChange(d: Date) {
    saveDate(d);
    setDate(d);
  }

  const { data: statuses, isLoading } = useGetVitalsTodayStatus({ date: dateStr });
  const { data: thresholds } = useGetVitalThresholds();

  const recheckNeeded = statuses?.filter((s) => s.needsRecheck) || [];
  const ok = statuses?.filter((s) => !s.needsRecheck && s.recordedToday) || [];
  const unrecorded = statuses?.filter((s) => !s.recordedToday) || [];

  const quickActions = [
    { label: "新規記録", icon: Plus, href: "/vitals/new", color: "bg-primary" },
    { label: "基準値設定", icon: Settings, href: "/settings" },
    {
      label: "PDF出力",
      icon: FileDown,
      onClick: () => printVitalsPdf(statuses ?? [], dateStr),
    },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="space-y-2">
          {/* Row 1: title + new button */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-800">
              バイタル
              {statuses && (
                <span className="ml-2 text-sm font-normal text-gray-500">（{statuses.length}名）</span>
              )}
            </h1>
            <Link href="/vitals/new">
              <Button size="sm" className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                新規記録
              </Button>
            </Link>
          </div>
          {/* Row 2: date nav + PDF */}
          <div className="flex items-center gap-2">
            <DayNav date={date} onChange={handleDateChange} />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => printVitalsPdf(statuses ?? [], dateStr)}
              title="バイタル一覧をPDF出力"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">PDF出力</span>
            </Button>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4">
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {recheckNeeded.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                      <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        再測定必要（{recheckNeeded.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {recheckNeeded.map((s) => (
                        <ResidentVitalCard key={s.residentId} status={s} dateStr={dateStr} />
                      ))}
                    </div>
                  </div>
                )}

                {unrecorded.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        未記録（{unrecorded.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {unrecorded.map((s) => (
                        <ResidentVitalCard key={s.residentId} status={s} dateStr={dateStr} />
                      ))}
                    </div>
                  </div>
                )}

                {ok.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        記録済み・異常なし（{ok.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {ok.map((s) => (
                        <ResidentVitalCard key={s.residentId} status={s} dateStr={dateStr} />
                      ))}
                    </div>
                  </div>
                )}

                {!isLoading && recheckNeeded.length === 0 && unrecorded.length === 0 && ok.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
                    この日のバイタルデータがありません
                  </div>
                )}
              </>
            )}
          </div>

          <div className="hidden lg:flex flex-col gap-4">
            <QuickActionsCard actions={quickActions} />

            {recheckNeeded.length > 0 && (
              <InfoCard title="再測定対象" titleColor="text-red-600" borderColor="border-red-100">
                <div className="space-y-2">
                  {recheckNeeded.slice(0, 5).map((s: any) => (
                    <div key={s.residentId} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-xs text-gray-700">{s.residentName}様</span>
                    </div>
                  ))}
                  {recheckNeeded.length > 5 && (
                    <p className="text-xs text-primary">他 {recheckNeeded.length - 5}名</p>
                  )}
                </div>
              </InfoCard>
            )}

            <InfoCard title="基準値（設定で変更可）">
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between"><span>体温 (KT)</span><span className="font-mono text-gray-700">{thresholds?.temperature?.min ?? 35.8} – {thresholds?.temperature?.max ?? 37.4}°C</span></div>
                <div className="flex justify-between"><span>血圧上 (BP)</span><span className="font-mono text-gray-700">{thresholds?.bpSystolic?.min ?? 90} – {thresholds?.bpSystolic?.max ?? 159} mmHg</span></div>
                <div className="flex justify-between"><span>血圧下</span><span className="font-mono text-gray-700">{thresholds?.bpDiastolic?.min ?? 60} – {thresholds?.bpDiastolic?.max ?? 99} mmHg</span></div>
                <div className="flex justify-between"><span>脈拍 (P)</span><span className="font-mono text-gray-700">{thresholds?.pulse?.min ?? 50} – {thresholds?.pulse?.max ?? 100} bpm</span></div>
                <div className="flex justify-between"><span>SpO2</span><span className="font-mono text-gray-700">{thresholds?.spo2?.min ?? 95} – {thresholds?.spo2?.max ?? 100}%</span></div>
              </div>
            </InfoCard>

            <StaffMemoCard memo="基準値を外れた場合は自動で「要再測定」に分類されます。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
