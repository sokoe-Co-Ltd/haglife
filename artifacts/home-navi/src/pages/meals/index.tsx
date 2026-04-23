import { Layout } from "@/components/layout";
import { useListResidents, useListMeals } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function MealsList() {
  const { data: residents, isLoading: isResidentsLoading } = useListResidents();
  const { data: meals, isLoading: isMealsLoading } = useListMeals({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const isLoading = isResidentsLoading || isMealsLoading;

  const getMealStatus = (residentId: number, type: string) => {
    return meals?.find(m => m.residentId === residentId && m.mealType === type);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-full mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">食事</h1>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">居室</TableHead>
                  <TableHead className="min-w-[150px]">氏名</TableHead>
                  <TableHead className="text-center">朝食</TableHead>
                  <TableHead className="text-center">昼食</TableHead>
                  <TableHead className="text-center">夕食</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  residents?.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell className="text-muted-foreground">{resident.roomNumber}</TableCell>
                      <TableCell className="font-medium">{resident.lastName} {resident.firstName}</TableCell>
                      <MealCell meal={getMealStatus(resident.id, "朝食")} />
                      <MealCell meal={getMealStatus(resident.id, "昼食")} />
                      <MealCell meal={getMealStatus(resident.id, "夕食")} />
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function MealCell({ meal }: { meal: any }) {
  if (!meal) {
    return <TableCell className="text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/50 transition-colors">-</TableCell>;
  }
  return (
    <TableCell className="text-center cursor-pointer hover:bg-muted/50 transition-colors">
      <div className="flex flex-col items-center justify-center text-xs">
        {meal.waterOnly ? (
          <span className="text-blue-600">水分のみ</span>
        ) : (
          <span>主: {meal.mainDishPercent}割 副: {meal.sideDishPercent}割</span>
        )}
        {meal.medicationOk && <span className="text-green-600 font-medium mt-1">服薬OK</span>}
      </div>
    </TableCell>
  );
}
