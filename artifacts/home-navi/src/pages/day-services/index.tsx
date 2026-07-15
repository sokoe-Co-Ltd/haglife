import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListDayServices,
  useToggleDayServicePrepared,
  useDeleteDayService,
  getListDayServicesQueryKey,
} from "@workspace/api-client-react";
import type { DayService } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  CheckCircle2,
  Circle,
  ClipboardList,
  Download,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Package,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { QuickActionsCard, StaffMemoCard, InfoCard } from "@/components/PageRightPanel";
import { DayServiceFormModal, WEEKDAYS } from "@/components/DayServiceFormModal";
import { ResidentPickerModal } from "@/components/ResidentPickerModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

function todayJa(): string {
  return ["日", "月", "火", "水", "木", "金", "土"][new Date().getDay()];
}

export default function DayServicesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<string>(todayJa());
  const { data: services, isLoading } = useListDayServices(
    { day_of_week: selectedDay },
    { query: { queryKey: getListDayServicesQueryKey({ day_of_week: selectedDay }) } },
  );
  const toggleMutation = useToggleDayServicePrepared();
  const deleteMutation = useDeleteDayService();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<{
    residentId: number;
    residentName?: string;
    existing?: DayService | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DayService | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDayServicesQueryKey() });

  const handleToggle = (id: number) => {
    toggleMutation.mutate({ id }, { onSuccess: invalidate });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "デイサービス情報を削除しました" });
          invalidate();
          setDeleteTarget(null);
        },
        onError: () => toast({ title: "削除に失敗しました", variant: "destructive" }),
      },
    );
  };

  const prepared = services?.filter((s) => s.isPrepared) ?? [];
  const unprepared = services?.filter((s) => !s.isPrepared) ?? [];
  const isToday = selectedDay === todayJa();

  const quickActions = [
    { label: "一括確認", icon: ClipboardList, color: "bg-primary" },
    { label: "準備物エクスポート", icon: Download },
  ];

  const photosOf = (s: DayService): string[] =>
    s.itemPhotoUrls?.length ? s.itemPhotoUrls : s.itemPhotoUrl ? [s.itemPhotoUrl] : [];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            デイ準備物
            {services && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                （{services.length}名）
              </span>
            )}
          </h1>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            登録
          </Button>
        </div>

        {/* 曜日タブ */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`shrink-0 w-11 h-11 rounded-full text-sm font-bold transition-colors ${
                selectedDay === d
                  ? "bg-primary text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {d}
              {d === todayJa() && (
                <span className="block text-[9px] leading-none font-normal">
                  今日
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
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
                {isToday ? "本日" : `${selectedDay}曜日`}のデイサービス予定はありません
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
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          利用曜日：{service.usageDays.join("・")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            setFormTarget({
                              residentId: service.residentId,
                              residentName: service.residentName ?? undefined,
                              existing: service,
                            })
                          }
                          className="p-2 rounded-full text-gray-400 hover:text-primary hover:bg-gray-50"
                          aria-label="編集"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(service)}
                          className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                          aria-label="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(service.id)}
                          className={`p-1.5 rounded-full transition-colors ${
                            service.isPrepared
                              ? "text-green-500 hover:text-green-600"
                              : "text-gray-300 hover:text-primary/70"
                          }`}
                          aria-label="準備状況を切り替え"
                        >
                          {service.isPrepared
                            ? <CheckCircle2 className="h-8 w-8" />
                            : <Circle className="h-8 w-8" />}
                        </button>
                      </div>
                    </div>

                    {service.itemsToBring && (
                      <div className="bg-gray-50 rounded-xl p-3 mb-2">
                        <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />持参物
                        </p>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{service.itemsToBring}</p>
                      </div>
                    )}

                    {service.itemLocations && (
                      <div className="bg-gray-50 rounded-xl p-3 mb-2">
                        <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />置き場所
                        </p>
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{service.itemLocations}</p>
                      </div>
                    )}

                    {photosOf(service).length > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {photosOf(service).map((url, i) => (
                          <button
                            key={i}
                            onClick={() => setPhotoView(url)}
                            className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200"
                          >
                            <img src={url} alt={`配置写真${i + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

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

      <ResidentPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(residentId, residentName) => {
          setPickerOpen(false);
          setFormTarget({ residentId, residentName });
        }}
      />

      {formTarget && (
        <DayServiceFormModal
          open={!!formTarget}
          onClose={() => setFormTarget(null)}
          residentId={formTarget.residentId}
          residentName={formTarget.residentName}
          existing={formTarget.existing ?? null}
          onSaved={invalidate}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>デイサービス情報を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.residentName}様のデイサービス情報（{deleteTarget?.facilityName ?? "施設名未登録"}）を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {photoView && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPhotoView(null)}
        >
          <img src={photoView} alt="配置写真" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </Layout>
  );
}
