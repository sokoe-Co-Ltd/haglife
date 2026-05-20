import { useAppDate } from "@/contexts/AppDateContext";
import { Layout } from "@/components/layout";
import { useListBathReports } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Bath, Plus, ChevronRight, Download, Printer, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { DayNav } from "@/components/date-nav";
import { StaffMemoCard, InfoCard } from "@/components/PageRightPanel";
import { isTodayBirthday } from "@/lib/birthday";

export default function BathReportsList() {
  const { appDate: date, setAppDate: setDate } = useAppDate();
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: reports, isLoading } = useListBathReports({ date: dateStr });

  // Show the most recent handoverNotes from today's reports in the staff memo
  const latestHandoverNotes = reports?.find((r: any) => r.handoverNotes)?.handoverNotes ?? null;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Bath className="h-5 w-5 text-primary" />
            入浴報告
            {reports && <span className="text-sm font-normal text-gray-500 ml-1">（{reports.length}件）</span>}
          </h1>
          <div className="flex items-center gap-2">
            <DayNav date={date} onChange={setDate} />
            <Link href="/bath-reports/new">
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
            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-4 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : reports?.length === 0 ? (
              <div className="text-center py-16 text-gray-400">この日の入浴報告はありません</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {reports?.map((report: any) => {
                  const isBirthday = isTodayBirthday(report.birthMonth, report.birthDay);
                  return (
                    <Link
                      key={report.id}
                      href={`/bath-reports/${report.id}`}
                      className={`flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${isBirthday ? "bg-red-50 hover:bg-red-50" : ""}`}
                    >
                      <div className="h-9 w-9 rounded-full bg-cyan-50 flex items-center justify-center shrink-0">
                        <Bath className="h-4 w-4 text-cyan-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            {isBirthday && <span className="text-sm">🎂</span>}
                            <span className={`text-sm font-bold ${isBirthday ? "text-red-600" : "text-gray-800"}`}>
                              {report.residentName}様
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">
                            {format(new Date(report.recordedAt), "HH:mm", { locale: ja })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">担当: {report.staffName ?? "未設定"}</p>
                        {report.handoverNotes && (
                          <div className="mt-1.5 flex items-start gap-1.5">
                            <MessageSquare className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-600 line-clamp-2">{report.handoverNotes}</p>
                          </div>
                        )}
                        {report.photoUrl && (
                          <div className="mt-1.5">
                            <img src={report.photoUrl} alt="添付写真" className="h-14 rounded object-cover" />
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 mt-1 shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <InfoCard title="本日の入浴">
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-600">報告件数</span>
                  <span className="text-sm font-bold text-primary">{reports?.length ?? 0}件</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm text-gray-600">申し送りあり</span>
                  <span className="text-sm font-bold text-gray-700">
                    {reports?.filter((r: any) => r.handoverNotes).length ?? 0}件
                  </span>
                </div>
              </div>
            </InfoCard>

            <StaffMemoCard
              memo={latestHandoverNotes ?? "入浴後の状態変化がある場合は申し送りにも共有してください。"}
              title={latestHandoverNotes ? "最新の申し送り" : "スタッフメモ"}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
