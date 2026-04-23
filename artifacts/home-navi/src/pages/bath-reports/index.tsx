import { Layout } from "@/components/layout";
import { useListBathReports } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Bath, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function BathReportsList() {
  const { data: reports, isLoading } = useListBathReports();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Bath className="h-5 w-5 text-teal-500" />
            入浴報告
          </h1>
          <Link href="/bath-reports/new">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
              <Plus className="h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </div>

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
            <div className="text-center py-16 text-gray-400">入浴報告はまだありません</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {reports?.map((report) => (
                <Link key={report.id} href={`/bath-reports/${report.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-800">{report.residentName}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {format(new Date(report.recordedAt), "MM/dd HH:mm", { locale: ja })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">担当: {report.staffName}</p>
                    {report.bathMemo && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{report.bathMemo}</p>
                    )}
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
