import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useListWeights, useGetResident } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, TrendingUp, Table as TableIcon } from "lucide-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { format, subMonths, subYears } from "date-fns";
import { ja } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from "recharts";

const PREVIEW_COUNT = 6;

type Period = "3m" | "6m" | "1y" | "all";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "3m", label: "3ヶ月" },
  { value: "6m", label: "6ヶ月" },
  { value: "1y", label: "1年間" },
  { value: "all", label: "全期間" },
];

function filterByPeriod(sorted: any[], period: Period): any[] {
  if (period === "all") return sorted;
  const now = new Date();
  const cutoff =
    period === "3m" ? subMonths(now, 3) :
    period === "6m" ? subMonths(now, 6) :
    subYears(now, 1);
  return sorted.filter((w) => new Date(w.recordedAt) >= cutoff);
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (payload?.notes) {
    return (
      <Dot cx={cx} cy={cy} r={5} fill="#f97316" stroke="#fff" strokeWidth={2} />
    );
  }
  return <Dot cx={cx} cy={cy} r={3.5} fill="#f97316" stroke="#fff" strokeWidth={1.5} />;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[110px]">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="text-primary font-bold text-sm">{d?.weight} kg</p>
      {d?.notes && (
        <p className="text-gray-500 mt-1 leading-relaxed border-t border-gray-100 pt-1">{d.notes}</p>
      )}
    </div>
  );
}

export default function WeightGraphDetail() {
  const params = useParams<{ id: string }>();
  const residentId = parseInt(params.id || "0");
  const [showAllTable, setShowAllTable] = useState(false);
  const [period, setPeriod] = useState<Period>("all");

  const { data: resident, isLoading: isResidentLoading } = useGetResident(residentId, {
    query: { enabled: !!residentId },
  });
  const { data: weights = [], isLoading: isWeightsLoading } = useListWeights(
    { resident_id: residentId },
    { query: { enabled: !!residentId } }
  );

  const isLoading = isResidentLoading || isWeightsLoading;

  const sorted = useMemo(
    () =>
      [...weights].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      ),
    [weights]
  );

  const filtered = useMemo(() => filterByPeriod(sorted, period), [sorted, period]);

  const chartData = filtered.map((w) => ({
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

  const filteredLatest = filtered[filtered.length - 1];
  const filteredFirst = filtered[0];
  const filteredDiff =
    filteredLatest && filteredFirst && filtered.length > 1
      ? (filteredLatest.weightKg - filteredFirst.weightKg).toFixed(1)
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

  const yMin = filtered.length
    ? Math.floor(Math.min(...filtered.map((w) => w.weightKg)) - 1)
    : "auto";
  const yMax = filtered.length
    ? Math.ceil(Math.max(...filtered.map((w) => w.weightKg)) + 1)
    : "auto";

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
              <TrendingUp className="h-5 w-5 text-primary" />
              体重推移グラフ
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {resident.roomNumber}　{resident.lastName} {resident.firstName}様
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
                <p className="text-xl font-bold text-primary">
                  {latest?.weightKg.toFixed(1)}
                  <span className="text-sm font-normal text-gray-500 ml-0.5">kg</span>
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">記録回数</p>
                <p className="text-xl font-bold text-gray-800">
                  {sorted.length}
                  <span className="text-sm font-normal text-gray-500 ml-0.5">回</span>
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">初回比</p>
                <p
                  className={`text-xl font-bold ${
                    diff == null
                      ? "text-gray-400"
                      : parseFloat(diff) > 0
                      ? "text-red-500"
                      : parseFloat(diff) < 0
                      ? "text-blue-500"
                      : "text-gray-800"
                  }`}
                >
                  {diff == null ? "-" : `${parseFloat(diff) > 0 ? "+" : ""}${diff}`}
                  {diff != null && (
                    <span className="text-sm font-normal text-gray-500 ml-0.5">kg</span>
                  )}
                </p>
              </div>
            </div>

            {/* Line Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              {/* Chart header + period selector */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  体重推移
                </h2>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPeriod(opt.value)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        period === opt.value
                          ? "bg-white text-primary shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  この期間に記録がありません
                </p>
              ) : filtered.length < 2 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  グラフ表示には2件以上の記録が必要です
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 16, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[yMin, yMax]}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        tickFormatter={(v) => `${v}kg`}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {filteredLatest && (
                        <ReferenceLine
                          y={filteredLatest.weightKg}
                          stroke="#f97316"
                          strokeDasharray="4 4"
                          strokeOpacity={0.5}
                          label={{
                            value: `最新 ${filteredLatest.weightKg.toFixed(1)}kg`,
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: "#f97316",
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#f97316"
                        strokeWidth={2.5}
                        dot={<CustomDot />}
                        activeDot={{ r: 6, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Period diff indicator */}
                  {filtered.length > 1 && period !== "all" && (
                    <div className="mt-2 flex items-center justify-end gap-1 text-xs text-gray-500">
                      <span>期間内の変化：</span>
                      <span
                        className={`font-bold ${
                          filteredDiff == null
                            ? "text-gray-400"
                            : parseFloat(filteredDiff) > 0
                            ? "text-red-500"
                            : parseFloat(filteredDiff) < 0
                            ? "text-blue-500"
                            : "text-gray-600"
                        }`}
                      >
                        {filteredDiff == null
                          ? "—"
                          : `${parseFloat(filteredDiff) > 0 ? "+" : ""}${filteredDiff} kg`}
                      </span>
                      <span className="text-gray-400 ml-1">
                        （{filtered.length}件）
                      </span>
                    </div>
                  )}
                </>
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
                      <td className="px-5 py-3 text-gray-400 text-xs">{w.notes || ""}</td>
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
