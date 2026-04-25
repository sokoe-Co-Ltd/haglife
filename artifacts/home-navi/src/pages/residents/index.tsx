import { Layout } from "@/components/layout";
import { useListResidents, useUpdateResident } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, ChevronRight, Eye, EyeOff, DoorOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { StaffMemoCard } from "@/components/PageRightPanel";
import { useState } from "react";
import { isTodayBirthday } from "@/lib/birthday";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type TabFilter = "すべて" | "女性" | "男性" | "退去者";
type VisibleFilter = "表示中" | "すべて";

export default function ResidentsList() {
  const { data: residents, isLoading } = useListResidents();
  const [tabFilter, setTabFilter] = useState<TabFilter>("すべて");
  const [visibleFilter, setVisibleFilter] = useState<VisibleFilter>("表示中");
  const updateMutation = useUpdateResident();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMovedOutTab = tabFilter === "退去者";

  const filtered = residents?.filter((r) => {
    if (isMovedOutTab) {
      return !!r.movedOutAt;
    }
    if (r.movedOutAt) return false;
    if (visibleFilter === "表示中" && !r.isVisible) return false;
    if (tabFilter !== "すべて" && r.gender !== tabFilter) return false;
    return true;
  }) ?? [];

  const activeCount = residents?.filter((r) => r.isVisible && !r.movedOutAt).length ?? 0;
  const movedOutCount = residents?.filter((r) => !!r.movedOutAt).length ?? 0;

  const toggleVisibility = (id: number, currentlyVisible: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateMutation.mutate(
      { id, data: { isVisible: !currentlyVisible } },
      {
        onSuccess: () => {
          toast({
            title: currentlyVisible ? "非表示にしました" : "表示に戻しました",
          });
          queryClient.invalidateQueries({ queryKey: ["/residents"] });
        },
        onError: () => {
          toast({ title: "更新に失敗しました", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            利用者一覧
            {!isLoading && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                （{activeCount}名在籍）
              </span>
            )}
          </h1>
          <Link href="/residents/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              新規登録
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {(["すべて", "女性", "男性"] as TabFilter[]).map((g) => (
              <button
                key={g}
                onClick={() => setTabFilter(g)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  tabFilter === g
                    ? "bg-primary text-white shadow-sm"
                    : "border border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                }`}
              >
                {g}
              </button>
            ))}
            <button
              onClick={() => setTabFilter("退去者")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                tabFilter === "退去者"
                  ? "bg-gray-500 text-white shadow-sm"
                  : "border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-600"
              }`}
            >
              <DoorOpen className="h-3.5 w-3.5" />
              退去者
              {movedOutCount > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0 ${
                  tabFilter === "退去者" ? "bg-white/30" : "bg-gray-100 text-gray-500"
                }`}>
                  {movedOutCount}
                </span>
              )}
            </button>
          </div>

          {!isMovedOutTab && (
            <div className="ml-auto">
              <button
                onClick={() => setVisibleFilter((prev) => (prev === "表示中" ? "すべて" : "表示中"))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  visibleFilter === "すべて"
                    ? "border-amber-400 text-amber-600 bg-amber-50"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {visibleFilter === "すべて" ? (
                  <><EyeOff className="h-3.5 w-3.5" />非表示も表示中</>
                ) : (
                  <><Eye className="h-3.5 w-3.5" />非表示も見る</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* PC: two-column layout */}
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          {/* Main content */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                {isMovedOutTab ? "退去者の記録はありません" : "該当する利用者がいません"}
              </div>
            ) : isMovedOutTab ? (
              /* 退去者タブ */
              <div className="divide-y divide-gray-50">
                {filtered
                  .slice()
                  .sort((a, b) => {
                    const da = a.movedOutAt ? new Date(a.movedOutAt).getTime() : 0;
                    const db = b.movedOutAt ? new Date(b.movedOutAt).getTime() : 0;
                    return db - da;
                  })
                  .map((resident) => (
                    <Link
                      key={resident.id}
                      href={`/residents/moved-out/${resident.id}`}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-sm shrink-0">
                        {resident.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400">{resident.roomNumber}</span>
                          <span className="text-sm font-bold text-gray-600">
                            {resident.lastName} {resident.firstName}
                          </span>
                          <span className="text-xs text-gray-500">{resident.gender}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            退去済
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-400">
                            退去日：
                            {resident.movedOutAt
                              ? format(new Date(resident.movedOutAt), "yyyy年M月d日", { locale: ja })
                              : "—"}
                          </span>
                          {resident.movedOutReason && (
                            <span className="text-xs text-gray-400">（{resident.movedOutReason}）</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                    </Link>
                  ))}
              </div>
            ) : (
              /* 通常タブ */
              <div className="divide-y divide-gray-50">
                {filtered.map((resident) => {
                  const isBirthday = isTodayBirthday(resident.birthMonth, resident.birthDay);
                  const isInactive = !resident.isVisible;
                  return (
                    <Link
                      key={resident.id}
                      href={isInactive ? "#" : `/health/${resident.id}`}
                      className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${
                        isInactive
                          ? "opacity-50 cursor-default"
                          : isBirthday
                          ? "bg-red-50 hover:bg-red-50"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={(e) => { if (isInactive) e.preventDefault(); }}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isInactive
                          ? "bg-gray-100 text-gray-400"
                          : isBirthday
                          ? "bg-red-100 text-red-600"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {isBirthday && !isInactive ? "🎂" : resident.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{resident.roomNumber}</span>
                          <span className={`text-sm font-bold ${isInactive ? "text-gray-400" : isBirthday ? "text-red-600" : "text-gray-800"}`}>
                            {resident.lastName} {resident.firstName}
                          </span>
                          <span className="text-xs text-gray-500">{resident.gender}</span>
                          {isBirthday && !isInactive && (
                            <span className="text-xs font-bold text-red-500">🎉 本日お誕生日</span>
                          )}
                          {isInactive && (
                            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              非表示
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => toggleVisibility(resident.id, resident.isVisible ?? true, e)}
                        className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                          isInactive
                            ? "text-gray-400 hover:text-primary hover:bg-primary/10"
                            : "text-gray-300 hover:text-amber-500 hover:bg-amber-50"
                        }`}
                        title={isInactive ? "表示に戻す" : "非表示にする"}
                      >
                        {isInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      {!isInactive && <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4">
            <StaffMemoCard memo="体調の変化が大きい方は、食事や水分摂取の状況も併せて確認をお願いします。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
