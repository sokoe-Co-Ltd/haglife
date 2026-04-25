import { Layout } from "@/components/layout";
import { useListResidents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, ChevronRight, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { QuickActionsCard, StaffMemoCard } from "@/components/PageRightPanel";
import { useState } from "react";
import { isTodayBirthday } from "@/lib/birthday";

const CARE_COLORS: Record<string, string> = {
  "要介護1": "bg-green-100 text-green-700",
  "要介護2": "bg-lime-100 text-lime-700",
  "要介護3": "bg-yellow-100 text-yellow-700",
  "要介護4": "bg-orange-100 text-orange-700",
  "要介護5": "bg-red-100 text-red-700",
};

type GenderFilter = "すべて" | "女性" | "男性";

export default function ResidentsList() {
  const { data: residents, isLoading } = useListResidents();
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("すべて");

  const filtered = residents?.filter((r) =>
    genderFilter === "すべて" ? true : r.gender === genderFilter
  ) ?? [];

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
            {residents && <span className="text-sm font-normal text-gray-500 ml-1">（{residents.length}名）</span>}
          </h1>
          <Link href="/residents/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              新規登録
            </Button>
          </Link>
        </div>

        {/* Gender filter tabs */}
        <div className="flex gap-2">
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
                  return (
                    <Link key={resident.id} href={`/health/${resident.id}`} className={`flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors ${isBirthday ? "bg-red-50 hover:bg-red-50" : ""}`}>
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isBirthday ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"}`}>
                        {isBirthday ? "🎂" : resident.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{resident.roomNumber}</span>
                          <span className={`text-sm font-bold ${isBirthday ? "text-red-600" : "text-gray-800"}`}>{resident.lastName} {resident.firstName}</span>
                          <span className="text-xs text-gray-500">{resident.gender}</span>
                          {isBirthday && <span className="text-xs font-bold text-red-500">🎉 本日お誕生日</span>}
                        </div>
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
            <QuickActionsCard actions={quickActions} />
            <StaffMemoCard memo="体調の変化が大きい方は、食事や水分摂取の状況も併せて確認をお願いします。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
