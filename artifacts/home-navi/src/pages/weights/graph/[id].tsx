import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListWeights, useGetResident } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, BarChart2, Table as TableIcon } from "lucide-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const PREVIEW_COUNT = 6;

export default function WeightGraphDetail() {
  const params = useParams<{ id: string }>();
  const residentId = parseInt(params.id || "0");
  const [showAllTable, setShowAllTable] = useState(false);

  const { data: resident, isLoading: isResidentLoading } = useGetResident(residentId, {
    query: { enabled: !!residentId },
  });
  const { data: weights = [], isLoading: isWeightsLoading } = useListWeights(
    { resident_id: residentId },
    { query: { enabled: !!residentId } }
  );

  const isLoading = isResidentLoading || isWeightsLoading;

  const sorted = [...weights].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const chartData = sorted.map((w) => ({
    date: format(new Date(w.recordedAt), "M/d", { locale: ja }),
    weight: w.weightKg,
    notes: w.notes,
  }));

  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const diff =
    latest && first && sorted.length > 1
      ? (latest.weightKg - first.weightKg).toFixed(1)
      : null;

  const tableRows = showAllTable ? sorted : sorted.slice(-PREVIEW_COUNT);

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!resident) {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-400">利用者が見つかりません</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/weights/graph">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              体重推移グラフ
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {resident.roomNumber}　{resident.lastName} {resident.firstName}
            </p>
          </div>
        </div>

        {weights.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
            体重記録がありません
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">最新体重</p>
                <p className="text-xl font-bold text-primary">{latest?.weightKg.toFixed(1)}<span className="text-sm font-normal text-gray-500 ml-0.5">kg</span></p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">記録回数</p>
                <p className="text-xl font-bold text-gray-800">{sorted.length}<span className="text-sm font-normal text-gray-500 ml-0.5">回</span></p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">初回比</p>
                <p className={`text-xl font-bold ${diff == null ? "text-gray-400" : parseFloat(diff) > 0 ? "text-red-500" : parseFloat(diff) < 0 ? "text-blue-500" : "text-gray-800"}`}>
                  {diff == null ? "-" : `${parseFloat(diff) > 0 ? "+" : ""}${diff}`}
                  {diff != null && <span className="text-sm font-normal text-gray-500 ml-0.5">kg</span>}
                </p>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                体重推移
              </h2>
              {chartData.length < 2 ? (
                <p className="text-sm text-gray-400 text-center py-8">グラフ表示には2件以上の記録が必要です</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}kg`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} kg`, "体重"]}
                      labelStyle={{ fontWeight: "bold" }}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    {latest && (
                      <ReferenceLine
                        y={latest.weightKg}
                        stroke="#f97316"
                        strokeDasharray="4 4"
                        label={{ value: "最新", position: "insideTopRight", fontSize: 10, fill: "#f97316" }}
                      />
                    )}
                    <Bar dataKey="weight" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" />
                  測定記録一覧
                </h2>
                <span className="text-xs text-gray-400">{sorted.length}件</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-xs font-bold text-gray-500">日付</th>
                    <th className="text-right px-5 py-2.5 text-xs font-bold text-gray-500">体重</th>
                    <th className="text-left px-5 py-2.5 text-xs font-bold text-gray-500">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tableRows.map((w: any) => (
                    <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-600">
                        {format(new Date(w.recordedAt), "yyyy年M月d日", { locale: ja })}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-800">
                        {w.weightKg.toFixed(1)} kg
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {w.notes || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length > PREVIEW_COUNT && (
                <div className="px-5 py-3 border-t border-gray-50 text-center">
                  <button
                    onClick={() => setShowAllTable((p) => !p)}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {showAllTable
                      ? "折りたたむ"
                      : `一覧を見る（残り ${sorted.length - PREVIEW_COUNT}件）`}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
