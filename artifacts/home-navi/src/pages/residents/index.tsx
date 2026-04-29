import { Layout } from "@/components/layout";
import { useListResidents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, ChevronRight, Hospital } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { StaffMemoCard } from "@/components/PageRightPanel";
import { useState } from "react";
import { isTodayBirthday } from "@/lib/birthday";

type TabFilter = "すべて" | "女性" | "男性" | "入院中";

export default function ResidentsList() {
  const { data: residents, isLoading } = useListResidents();
  const [tabFilter, setTabFilter] = useState<TabFilter>("すべて");

  const isHospitalTab = tabFilter === "入院中";

  const filtered = residents?.filter((r) => {
    if (r.movedOutAt) return false;
    if (isHospitalTab) return !!r.hospitalizedAt;
    if (tabFilter !== "すべて" && r.gender !== tabFilter) return false;
    return true;
  }) ?? [];

  const activeCount = residents?.filter((r) => !r.movedOutAt).length ?? 0;
  const hospitalCount = residents?.filter((r) => !r.movedOutAt && !!r.hospitalizedAt).length ?? 0;

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
            onClick={() => setTabFilter("入院中")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tabFilter === "入院中"
                ? "bg-blue-500 text-white shadow-sm"
                : "border border-blue-200 text-blue-600 hover:bg-blue-50"
            }`}
          >
            <Hospital className="h-3.5 w-3.5" />
            入院中
            {hospitalCount > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0 font-bold ${
                tabFilter === "入院中" ? "bg-white/30" : "bg-blue-100 text-blue-700"
              }`}>
                {hospitalCount}
              </span>
            )}
          </button>
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
                {isHospitalTab ? "現在入院中の利用者はいません" : "該当する利用者がいません"}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((resident) => {
                  const isBirthday = isTodayBirthday(resident.birthMonth, resident.birthDay);
                  const isHospitalized = !!resident.hospitalizedAt;
                  return (
                    <Link
                      key={resident.id}
                      href={`/health/${resident.id}`}
                      className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${
                        isHospitalized
                          ? "bg-blue-50/50 hover:bg-blue-50"
                          : isBirthday
                          ? "bg-red-50 hover:bg-red-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isHospitalized
                          ? "bg-blue-100 text-blue-600"
                          : isBirthday
                          ? "bg-red-100 text-red-600"
                          : "bg-primary/10 text-primary"
                      } ${resident.gender === "男性" ? "ring-2 ring-blue-400" : "ring-2 ring-red-400"}`}>
                        {isBirthday && !isHospitalized ? "🎂" : resident.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{resident.roomNumber}</span>
                          <span className={`text-sm font-bold ${
                            isHospitalized ? "text-blue-700" : isBirthday ? "text-red-600" : "text-gray-800"
                          }`}>
                            {resident.lastName} {resident.firstName}様
                          </span>
                          <span className="text-xs text-gray-500">{resident.gender}</span>
                          {isHospitalized && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                              <Hospital className="h-3 w-3" />入院中
                            </span>
                          )}
                        </div>
                        {isBirthday && !isHospitalized && (
                          <span className="text-xs font-bold text-red-500 mt-0.5 block">🎉 本日お誕生日</span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
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
