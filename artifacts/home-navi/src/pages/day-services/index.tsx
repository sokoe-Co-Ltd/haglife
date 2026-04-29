import { Layout } from "@/components/layout";
import { useListDayServices, useToggleDayServicePrepared } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, CheckCircle2, Circle, ClipboardList, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListDayServicesQueryKey } from "@workspace/api-client-react";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";

export default function DayServicesList() {
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListDayServices();
  const toggleMutation = useToggleDayServicePrepared();

  const handleToggle = (id: number) => {
    toggleMutation.mutate({ data: { id } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDayServicesQueryKey() }),
    });
  };

  const prepared = services?.filter((s) => s.isPrepared) ?? [];
  const unprepared = services?.filter((s) => !s.isPrepared) ?? [];

  const quickActions = [
    { label: "一括確認", icon: ClipboardList, color: "bg-primary" },
    { label: "準備物エクスポート", icon: Download },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          デイ準備物
          {services && <span className="text-sm font-normal text-gray-500 ml-1">（{services.length}名）</span>}
        </h1>

        {/* PC: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          {/* Main content */}
          <div className="space-y-3">
            {isLoading ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <Skeleton className="h-5 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </>
            ) : services?.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
                本日のデイサービス予定はありません
              </div>
            ) : (
              <>
                {services?.map((service) => (
                  <div
                    key={service.id}
                    className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
                      service.isPrepared ? "border-green-200 bg-green-50/50" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary">{service.residentName}様</p>
                        <p className="text-xs text-gray-500 mt-0.5">{service.facilityName}</p>
                      </div>
                      <button
                        onClick={() => handleToggle(service.id)}
                        className={`p-1.5 rounded-full transition-colors shrink-0 ${
                          service.isPrepared
                            ? "text-green-500 hover:text-green-600"
                            : "text-gray-300 hover:text-primary/70"
                        }`}
                      >
                        {service.isPrepared
                          ? <CheckCircle2 className="h-8 w-8" />
                          : <Circle className="h-8 w-8" />
                        }
                      </button>
                    </div>

                    {service.itemsToBring && (
                      <div className="bg-gray-50 rounded-xl p-3 mb-2">
                        <p className="text-xs font-bold text-gray-700 mb-1">持参物</p>
                        <p className="text-xs text-gray-600">{service.itemsToBring}</p>
                      </div>
                    )}

                    {service.itemLocations && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-700 mb-1">置き場所</p>
                        <p className="text-xs text-gray-600">{service.itemLocations}</p>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <QuickActionsCard actions={quickActions} />

            <InfoCard title="準備状況">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span className="text-sm text-gray-600">準備済み</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">{prepared.length}名</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                    <span className="text-sm text-gray-600">未準備</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{unprepared.length}名</span>
                </div>
              </div>
            </InfoCard>

            <StaffMemoCard memo="忘れ物がないよう、送迎前に持参物を確認してください。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
