import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetWeightsMonthlyStatus } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Weight, ChevronRight, ClipboardList, LineChart, Calendar, Download } from "lucide-react";
import { Link } from "wouter";
import { MonthNav } from "@/components/date-nav";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";

function ResidentWeightCard({ status }: { status: any }) {
  return (
    <Link href={`/weights/${status.residentId}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {status.isRecordedThisMonth ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">測定済</span>
        ) : (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-primary text-primary">未測定</span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
          <span className="text-sm font-semibold text-gray-800">{status.residentName}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status.isRecordedThisMonth && (
          <span className="text-sm font-bold text-gray-700">{status.latestWeightKg} kg</span>
        )}
        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
      </div>
    </Link>
  );
}

export default function WeightsList() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data: statuses, isLoading } = useGetWeightsMonthlyStatus({ year, month });

  const unrecorded = statuses?.filter((s) => !s.isRecordedThisMonth) || [];
  const recorded = statuses?.filter((s) => s.isRecordedThisMonth) || [];

  const quickActions = [
    { label: "一括記録", icon: ClipboardList, color: "bg-primary" },
    { label: "推移グラフ", icon: LineChart },
    { label: "月別カレンダー", icon: Calendar },
    { label: "記録エクスポート", icon: Download },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Weight className="h-5 w-5 text-primary" />
            体重
            {statuses && <span className="text-sm font-normal text-gray-500 ml-1">（{statuses.length}名）</span>}
          </h1>
          <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        </div>

        {/* PC: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          {/* Main content */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4"><Skeleton className="h-4 w-2/3" /></div>
                ))}
              </div>
            ) : (
              <>
                {unrecorded.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        今月未測定（{unrecorded.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {unrecorded.map((s) => <ResidentWeightCard key={s.residentId} status={s} />)}
                    </div>
                  </div>
                )}

                {recorded.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        最近の測定済み（{recorded.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {recorded.map((s) => <ResidentWeightCard key={s.residentId} status={s} />)}
                    </div>
                  </div>
                )}

                {!isLoading && unrecorded.length === 0 && recorded.length === 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
                    この月の体重データがありません
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <QuickActionsCard actions={quickActions} />

            <InfoCard title="サマリー">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-600">今月未測定</span>
                  <span className="text-sm font-bold text-primary">{unrecorded.length}名</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-600">測定済み</span>
                  <span className="text-sm font-bold text-green-600">{recorded.length}名</span>
                </div>
              </div>
            </InfoCard>

            <StaffMemoCard memo="体重の変化が大きい方は、食事や水分摂取の状況も併せて確認をお願いします。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
