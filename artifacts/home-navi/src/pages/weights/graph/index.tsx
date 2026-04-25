import { Layout } from "@/components/layout";
import { useListResidents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, BarChart2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function WeightGraphList() {
  const { data: residents, isLoading } = useListResidents();
  const visible = residents?.filter((r) => r.isVisible !== false) ?? [];

  return (
    <Layout>
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/weights">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            体重推移グラフ
            {!isLoading && (
              <span className="text-sm font-normal text-gray-400 ml-1">（{visible.length}名）</span>
            )}
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-4">
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-gray-400">利用者が登録されていません</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {visible.map((r) => (
                <Link
                  key={r.id}
                  href={`/weights/graph/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {r.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{r.roomNumber}</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {r.lastName} {r.firstName}
                      </span>
                      <span className="text-xs text-gray-400">{r.gender}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
