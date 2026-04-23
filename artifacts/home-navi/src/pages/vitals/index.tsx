import { Layout } from "@/components/layout";
import { useGetVitalsTodayStatus } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "wouter";

function ResidentVitalCard({ status }: { status: any }) {
  const needsRecheck = status.needsRecheck;
  const isRecorded = status.isRecorded;

  return (
    <Link href={`/vitals/${status.residentId}`} className={`flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors rounded-none`}>
      <div className="flex items-center gap-3 min-w-0">
        {needsRecheck ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">要再測定</span>
        ) : isRecorded ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-600">記録済</span>
        ) : (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-orange-400 text-orange-500">未記録</span>
        )}
        <div className="min-w-0">
          <span className="text-xs text-gray-400 mr-2">{status.roomNumber}</span>
          <span className="text-sm font-semibold text-gray-800">{status.residentName}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {isRecorded && (
          <div className="hidden sm:flex gap-3 text-xs text-gray-500">
            <span>KT: <strong className={`${needsRecheck ? "text-red-600" : "text-gray-700"}`}>{status.temperature}</strong></span>
            <span>BP: <strong className="text-gray-700">{status.bpSystolic}/{status.bpDiastolic}</strong></span>
            <span>P: <strong className="text-gray-700">{status.pulse}</strong></span>
            <span>SpO2: <strong className="text-gray-700">{status.spo2}%</strong></span>
          </div>
        )}
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </Link>
  );
}

export default function VitalsList() {
  const { data: statuses, isLoading } = useGetVitalsTodayStatus();

  const recheckNeeded = statuses?.filter((s) => s.needsRecheck) || [];
  const ok = statuses?.filter((s) => !s.needsRecheck && s.isRecorded) || [];
  const unrecorded = statuses?.filter((s) => !s.isRecorded) || [];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-800">バイタル</h1>

        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-4">
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {recheckNeeded.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-red-100 bg-red-50">
                  <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    再測定必要（{recheckNeeded.length}名）
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {recheckNeeded.map((s) => <ResidentVitalCard key={s.residentId} status={s} />)}
                </div>
              </div>
            )}

            {unrecorded.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-orange-500" />
                    未記録（{unrecorded.length}名）
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {unrecorded.map((s) => <ResidentVitalCard key={s.residentId} status={s} />)}
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
                  {ok.map((s) => <ResidentVitalCard key={s.residentId} status={s} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
