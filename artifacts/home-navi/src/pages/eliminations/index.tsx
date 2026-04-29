import { useState } from "react";
import { Layout } from "@/components/layout";
import { useCheckEliminationRound, useResetEliminationRound } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toilet, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getGetEliminationRoundStatusQueryKey } from "@workspace/api-client-react";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";
import { DayNav } from "@/components/date-nav";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { isTodayBirthday } from "@/lib/birthday";

type RoundStatus = {
  residentId: number;
  residentName: string;
  roomNumber: string;
  photoUrl: string | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  stomaManagement: boolean;
  lastBmRecordedAt: string | null;
  daysSinceLastBm: number | null;
  checkedThisRound: boolean;
  needsAttention: boolean;
};

function BmBadge({ days, stomaManagement }: { days: number | null; stomaManagement: boolean }) {
  if (stomaManagement) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">
        ストーマ
      </span>
    );
  }
  if (days === null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
        排便未記録
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">
        本日排便あり
      </span>
    );
  }
  if (days >= 3) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary">
        排便{days}日経過
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-600">
      排便{days}日経過
    </span>
  );
}

function ResidentEliminationCard({
  status,
  onCheck,
  dateIsToday,
}: {
  status: RoundStatus;
  onCheck: (id: number, e: React.MouseEvent) => void;
  dateIsToday: boolean;
}) {
  const needsAttention = status.needsAttention;
  const checked = status.checkedThisRound;
  const isBirthday = isTodayBirthday(status.birthMonth, status.birthDay);

  return (
    <Link href={`/eliminations/${status.residentId}`} className={`flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors ${isBirthday ? "bg-red-50 hover:bg-red-50" : ""}`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          {isBirthday ? (
            <div className="flex flex-col gap-0.5">
              <div>
                <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
                <span className="text-sm font-semibold text-red-600">{status.residentName}様</span>
              </div>
              <span className="text-xs font-bold text-red-500">🎂 本日お誕生日</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{status.roomNumber}</span>
              <span className="text-sm font-semibold text-gray-800">{status.residentName}様</span>
            </div>
          )}
          <div className="mt-1">
            <BmBadge days={status.daysSinceLastBm} stomaManagement={status.stomaManagement} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2 shrink-0">
        {dateIsToday ? (
          <button
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 ${
              checked
                ? "bg-primary text-white shadow-[0_0_10px_2px_rgba(249,115,22,0.5)]"
                : "border-2 border-gray-200 text-gray-400 hover:border-primary hover:text-primary"
            }`}
            onClick={(e) => onCheck(status.residentId, e)}
            title={checked ? "確認済み" : "確認する"}
          >
            <Toilet className="h-4 w-4" />
          </button>
        ) : (
          <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 ${checked ? "border-primary/40 bg-primary/10 text-primary/50" : "border-gray-100 text-gray-200"}`}>
            <Toilet className="h-4 w-4" />
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </Link>
  );
}

function useRoundStatus(dateStr: string) {
  return useQuery<RoundStatus[]>({
    queryKey: [...getGetEliminationRoundStatusQueryKey(), dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/eliminations/round-status?date=${dateStr}`);
      if (!res.ok) throw new Error("Failed to fetch round status");
      return res.json();
    },
  });
}

export default function EliminationsList() {
  const [date, setDate] = useState<Date>(() => new Date());
  const queryClient = useQueryClient();
  const dateStr = format(date, "yyyy-MM-dd");
  const dateIsToday = dateFnsIsToday(date);

  const { data: statuses, isLoading } = useRoundStatus(dateStr);
  const checkMutation = useCheckEliminationRound();
  const resetMutation = useResetEliminationRound();

  const handleCheck = (residentId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dateIsToday) return;
    checkMutation.mutate({ data: { residentId } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [...getGetEliminationRoundStatusQueryKey(), dateStr] }),
    });
  };

  const handleReset = () => {
    if (confirm("ラウンド状態をリセットしますか？")) {
      resetMutation.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [...getGetEliminationRoundStatusQueryKey(), dateStr] }),
      });
    }
  };

  const needsAttention = statuses?.filter((s) => s.needsAttention) || [];
  const ok = statuses?.filter((s) => !s.needsAttention) || [];

  const quickActions = [
    ...(dateIsToday ? [{ label: "ラウンドリセット", icon: RefreshCw, onClick: handleReset }] : []),
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Toilet className="h-5 w-5 text-primary" />
            排泄
            {statuses && <span className="ml-2 text-sm font-normal text-gray-500">（{statuses.length}名）</span>}
          </h1>
          <div className="flex items-center gap-2">
            <DayNav date={date} onChange={setDate} />
            {dateIsToday && (
              <Button variant="outline" size="sm" onClick={handleReset} disabled={resetMutation.isPending} className="gap-1.5 lg:hidden">
                <RefreshCw className="h-4 w-4" />
                リセット
              </Button>
            )}
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-4"><Skeleton className="h-4 w-2/3" /></div>
                ))}
              </div>
            ) : (
              <>
                {needsAttention.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-primary/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-primary/10 bg-primary/5">
                      <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        排便要確認（{needsAttention.length}名）
                      </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {needsAttention.map((s) => (
                        <ResidentEliminationCard key={s.residentId} status={s} onCheck={handleCheck} dateIsToday={dateIsToday} />
                      ))}
                    </div>
                  </div>
                )}

                {ok.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-bold text-gray-700">通常（{ok.length}名）</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {ok.map((s) => (
                        <ResidentEliminationCard key={s.residentId} status={s} onCheck={handleCheck} dateIsToday={dateIsToday} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="hidden lg:flex flex-col gap-4">
            {dateIsToday && <QuickActionsCard actions={quickActions} />}

            {needsAttention.length > 0 && (
              <InfoCard title="排便要確認" titleColor="text-primary" borderColor="border-primary/20">
                <div className="space-y-2">
                  {needsAttention.slice(0, 5).map((s) => (
                    <div key={s.residentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        <span className="text-xs text-gray-700">{s.residentName}様</span>
                      </div>
                      <span className="text-xs text-primary font-bold">
                        {s.daysSinceLastBm !== null ? `${s.daysSinceLastBm}日経過` : "未記録"}
                      </span>
                    </div>
                  ))}
                  {needsAttention.length > 5 && (
                    <p className="text-xs text-primary">他 {needsAttention.length - 5}名</p>
                  )}
                </div>
              </InfoCard>
            )}

            <StaffMemoCard memo="声かけを意識して実施。体調の変化がないか注意深く観察をお願いします。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
