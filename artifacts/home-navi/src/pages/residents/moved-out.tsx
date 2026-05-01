import { Layout } from "@/components/layout";
import { useListResidents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DoorOpen, ChevronRight, Calendar } from "lucide-react";
import { Link } from "wouter";
import { ResidentAvatar } from "@/components/ResidentAvatar";
import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type GenderFilter = "すべて" | "女性" | "男性";

export default function MovedOutResidentsList() {
  const { data: residents = [], isLoading } = useListResidents({ visible_only: false });
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("すべて");

  const movedOut = residents.filter((r) => !!r.movedOutAt);

  const filtered = movedOut.filter((r) => {
    if (genderFilter !== "すべて" && r.gender !== genderFilter) return false;
    return true;
  }).sort((a, b) => {
    const da = a.movedOutAt ? new Date(a.movedOutAt).getTime() : 0;
    const db = b.movedOutAt ? new Date(b.movedOutAt).getTime() : 0;
    return db - da;
  });

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-primary" />
            退去者情報
            {!isLoading && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                （{movedOut.length}名）
              </span>
            )}
          </h1>
        </div>

        <p className="text-xs text-gray-400">
          退去者情報は退去日から5年間保管されます。タップで詳細情報を確認できます。
        </p>

        {/* Gender filter */}
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, i) => (
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
              {movedOut.length === 0 ? "退去者の記録はありません" : "該当する退去者がいません"}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((resident) => (
                <Link
                  key={resident.id}
                  href={`/residents/moved-out/${resident.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <ResidentAvatar resident={resident} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">{resident.roomNumber}</span>
                      <span className="text-sm font-bold text-gray-700">
                        {resident.lastName} {resident.firstName}様
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
                        <span className="text-xs text-gray-400 ml-1">
                          （{resident.movedOutReason}）
                        </span>
                      )}
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
