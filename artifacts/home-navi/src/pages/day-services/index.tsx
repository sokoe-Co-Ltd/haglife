import { Layout } from "@/components/layout";
import { useListDayServices, useToggleDayServicePrepared } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getListDayServicesQueryKey } from "@workspace/api-client-react";

export default function DayServicesList() {
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListDayServices();
  const toggleMutation = useToggleDayServicePrepared();

  const handleToggle = (id: number) => {
    toggleMutation.mutate({ data: { id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDayServicesQueryKey() });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-6 w-6" />
          デイ準備物
        </h1>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          ) : services?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-lg border">
              本日のデイサービス予定はありません
            </div>
          ) : (
            services?.map((service) => (
              <Card key={service.id} className={service.isPrepared ? "bg-muted/30 border-green-500/20" : ""}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-bold text-lg text-primary">{service.residentName}</div>
                      <div className="text-sm font-medium text-muted-foreground mt-1">{service.facilityName}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggle(service.id)}
                      className={service.isPrepared ? "text-green-500" : "text-muted-foreground"}
                    >
                      {service.isPrepared ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                    </Button>
                  </div>
                  
                  {service.itemsToBring && (
                    <div className="bg-secondary/50 p-3 rounded-md mb-2">
                      <p className="text-sm font-bold mb-1">持参物</p>
                      <p className="text-sm">{service.itemsToBring}</p>
                    </div>
                  )}
                  
                  {service.itemLocations && (
                    <div className="bg-secondary/50 p-3 rounded-md">
                      <p className="text-sm font-bold mb-1">置き場所</p>
                      <p className="text-sm">{service.itemLocations}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
