import { Layout } from "@/components/layout";
import { useListResidents, useListMeals } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Utensils } from "lucide-react";
import { format } from "date-fns";

function MealCell({ meal }: { meal: any }) {
  if (!meal) {
    return (
      <TableCell className="text-center py-3">
        <span className="text-xs text-gray-300">—</span>
      </TableCell>
    );
  }
  return (
    <TableCell className="text-center py-3">
      <div className="flex flex-col items-center text-xs">
        {meal.waterOnly ? (
          <span className="text-blue-500 font-semibold">水分のみ</span>
        ) : (
          <span className="text-gray-700">主: {meal.mainDishPercent}割 副: {meal.sideDishPercent}割</span>
        )}
        {meal.medicationOk && <span className="text-green-600 font-semibold mt-0.5">服薬OK</span>}
      </div>
    </TableCell>
  );
}

export default function MealsList() {
  const { data: residents, isLoading: isResidentsLoading } = useListResidents();
  const { data: meals, isLoading: isMealsLoading } = useListMeals({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const isLoading = isResidentsLoading || isMealsLoading;

  const getMealStatus = (residentId: number, type: string) => {
    return meals?.find((m) => m.residentId === residentId && m.mealType === type);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Utensils className="h-5 w-5 text-green-500" />
          食事（{format(new Date(), "M月d日")}）
        </h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-100">
                  <TableHead className="w-16 text-xs font-bold text-gray-600 px-4">居室</TableHead>
                  <TableHead className="min-w-[120px] text-xs font-bold text-gray-600">氏名</TableHead>
                  <TableHead className="text-center text-xs font-bold text-gray-600">朝食</TableHead>
                  <TableHead className="text-center text-xs font-bold text-gray-600">昼食</TableHead>
                  <TableHead className="text-center text-xs font-bold text-gray-600">夕食</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-gray-50">
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  residents?.map((resident) => (
                    <TableRow key={resident.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <TableCell className="text-xs text-gray-400 px-4">{resident.roomNumber}</TableCell>
                      <TableCell className="text-sm font-semibold text-gray-800">{resident.lastName} {resident.firstName}</TableCell>
                      <MealCell meal={getMealStatus(resident.id, "朝食")} />
                      <MealCell meal={getMealStatus(resident.id, "昼食")} />
                      <MealCell meal={getMealStatus(resident.id, "夕食")} />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
