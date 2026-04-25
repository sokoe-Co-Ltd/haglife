import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetWeightsMonthlyStatus, useListWeights } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Weight,
  ChevronRight,
  BarChart2,
  MessageSquare,
} from "lucide-react";
import { Link } from "wouter";
import { MonthNav } from "@/components/date-nav";
import { QuickActionsCard, InfoCard } from "@/components/PageRightPanel";
import { isTodayBirthday } from "@/lib/birthday";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const NOTE_PREVIEW = 3;

function ResidentWeightCard({ status }: { status: any }) {
  const isBirthday = isTodayBirthday(status.birthMonth, status.birthDay);
  const thisMonthWeight = status.latestWeight;
  const everWeight = status.latestWeightEver;
  return (
    <Link
      href={`/weights/${status.residentId}`}
      className={`flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors ${isBirthday ? "bg-red-50 hover:bg-red-50" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {status.recordedThisMonth ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">
            測定済
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-primary text-primary">
            未測定
          </span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
          {isBirthday && <span className="mr-1">🎂</span>}
          <span className={`text-sm font-semibold ${isBirthday ? "text-red-600" : "text-gray-800"}`}>
            {status.residentName}
          </span>
          {isBirthday && <span className="ml-1.5 text-xs font-bold text-red-500">本日お誕生日</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {thisMonthWeight != null ? (
          <span className="text-sm font-bold text-gray-800">{thisMonthWeight.toFixed(1)} kg</span>
        ) : everWeight != null ? (
          <span className="text-sm text-gray-400">直近 {everWeight.toFixed(1)} kg</span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
      </div>
    </Link>
  );
}

function WeightNotesPanel() {
  const [showAll, setShowAll] = useState(false);
  const { data: weights = [] } = useListWeights({});

  const withNotes = weights
    .filter((w: any) => w.notes && w.notes.trim())
    .sort((a: any, b: any) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  const displayed = showAll ? withNotes : withNotes.slice(0, NOTE_PREVIEW);

  if (withNotes.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-gray-700">スタッフメモ</h3>
        </div>
        <div className="px-4 py-3 text-xs text-gray-400">備考の記録はありません</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-gray-700">スタッフメモ</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {displayed.map((w: any) => (
          <div key={w.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-700">{w.residentName}</span>
              <span className="text-xs text-gray-400">
                {format(new Date(w.recordedAt), "M/d", { locale: ja })}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{w.notes}</p>
          </div>
        ))}
      </div>
      {withNotes.length > NOTE_PREVIEW && (
        <div className="px-4 py-2.5 border-t border-gray-50 text-center">
          <button
            onClick={() => setShowAll((p) => !p)}
            className="text-xs text-primary hover:underline font-medium"
          >
            {showAll ? "折りたたむ" : `一覧を見る（残り ${withNotes.length - NOTE_PREVIEW}件）`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function WeightsList() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data: statuses, isLoading } = useGetWeightsMonthlyStatus({ year, month });

  const unrecorded = statuses?.filter((s) => !s.recordedThisMonth) || [];
  const recorded = statuses?.filter((s) => s.recordedThisMonth) || [];

  const quickActions = [
    { label: "推移グラフ", icon: BarChart2, href: "/weights/graph" },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Weight className="h-5 w-5 text-primary" />
            体重
            {statuses && (
              <span className="text-sm font-normal text-gray-500 ml-1">（{statuses.length}名）</span>
            )}
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
                  <div key={i} className="px-4 py-4">
                    <Skeleton className="h-4 w-2/3" />
                  </div>
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
                      {unrecorded.map((s) => (
                        <ResidentWeightCard key={s.residentId} status={s} />
                      ))}
                    </div>
                  </div>
                )}

                {recorded.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        測定済み（{recorded.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {recorded.map((s) => (
                        <ResidentWeightCard key={s.residentId} status={s} />
                      ))}
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

            <WeightNotesPanel />
          </div>
        </div>
      </div>
    </Layout>
  );
}
