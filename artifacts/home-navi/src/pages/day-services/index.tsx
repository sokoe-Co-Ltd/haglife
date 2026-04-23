import { Layout } from "@/components/layout";
import { useListDayServices, useToggleDayServicePrepared } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, CheckCircle2, Circle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListDayServicesQueryKey } from "@workspace/api-client-react";

export default function DayServicesList() {
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListDayServices();
  const toggleMutation = useToggleDayServicePrepared();

  const handleToggle = (id: number) => {
    toggleMutation.mutate({ data: { id } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDayServicesQueryKey() }),
    });
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          デイ準備物
        </h1>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : services?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
            本日のデイサービス予定はありません
          </div>
        ) : (
          <div className="space-y-3">
            {services?.map((service) => (
              <div
                key={service.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
                  service.isPrepared ? "border-green-200 bg-green-50/50" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-primary">{service.residentName}</p>
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
          </div>
        )}
      </div>
    </Layout>
  );
}
