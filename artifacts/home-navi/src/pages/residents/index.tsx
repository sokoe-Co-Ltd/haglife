import { Layout } from "@/components/layout";
import { useListResidents, useUpdateResident } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, ChevronRight, Download, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { QuickActionsCard, StaffMemoCard } from "@/components/PageRightPanel";
import { useState } from "react";
import { isTodayBirthday } from "@/lib/birthday";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type GenderFilter = "すべて" | "女性" | "男性";
type VisibleFilter = "表示中" | "すべて";

export default function ResidentsList() {
  const { data: residents, isLoading } = useListResidents();
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("すべて");
  const [visibleFilter, setVisibleFilter] = useState<VisibleFilter>("表示中");
  const updateMutation = useUpdateResident();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filtered = residents?.filter((r) => {
    if (visibleFilter === "表示中" && !r.isVisible) return false;
    if (genderFilter !== "すべて" && r.gender !== genderFilter) return false;
    return true;
  }) ?? [];

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

  const quickActions = [
    { label: "新規登録", icon: Plus, href: "/residents/new", color: "bg-primary" },
    { label: "名簿エクスポート", icon: Download },
    { label: "一括更新", icon: RefreshCw },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            利用者一覧
            {residents && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                （{residents.filter((r) => r.isVisible).length}名在籍）
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

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {(["すべて", "女性", "男性"] as GenderFilter[]).map((g) => (
              <button
                key={g}
                onClick={() => setGenderFilter(g)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  genderFilter === g
                    ? "bg-primary text-white shadow-sm"
                    : "border border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
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
              <div className="py-16 text-center text-gray-400">該当する利用者がいません</div>
            ) : (
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
                      {/* Visibility toggle button */}
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
            <QuickActionsCard actions={quickActions} />
            <StaffMemoCard memo="体調の変化が大きい方は、食事や水分摂取の状況も併せて確認をお願いします。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
