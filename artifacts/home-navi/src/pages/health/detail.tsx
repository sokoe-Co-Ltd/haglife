import { Layout } from "@/components/layout";
import { useGetResidentHealthSummary, useGetResident, useUpdateResident } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Users, Phone, MapPin, Briefcase, UserCheck, DoorOpen, Hospital } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function HealthDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resident, isLoading: isResidentLoading } = useGetResident(id, { query: { enabled: !!id } });
  const { data: summary, isLoading: isSummaryLoading } = useGetResidentHealthSummary(id, { query: { enabled: !!id } });
  const updateMutation = useUpdateResident();

  const isLoading = isResidentLoading || isSummaryLoading;

  const [showMoveOutDialog, setShowMoveOutDialog] = useState(false);
  const [moveOutDate, setMoveOutDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [moveOutReason, setMoveOutReason] = useState("");
  const [moveOutLoading, setMoveOutLoading] = useState(false);

  const [showHospitalDialog, setShowHospitalDialog] = useState(false);
  const [hospitalDate, setHospitalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hospitalReason, setHospitalReason] = useState("");
  const [hospitalLoading, setHospitalLoading] = useState(false);

  function handleMoveOut() {
    if (!moveOutDate) return;
    setMoveOutLoading(true);
    updateMutation.mutate(
      {
        id,
        data: {
          movedOutAt: moveOutDate,
          movedOutReason: moveOutReason || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/residents"] });
          toast({ title: "退去処理が完了しました" });
          setShowMoveOutDialog(false);
          navigate("/residents");
        },
        onError: () => {
          toast({ title: "退去処理に失敗しました", variant: "destructive" });
        },
        onSettled: () => setMoveOutLoading(false),
      }
    );
  }

  function handleHospitalize() {
    if (!hospitalDate) return;
    setHospitalLoading(true);
    updateMutation.mutate(
      {
        id,
        data: {
          hospitalizedAt: hospitalDate,
          hospitalizedReason: hospitalReason || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/residents"] });
          toast({ title: "入院として記録しました" });
          setShowHospitalDialog(false);
        },
        onError: () => {
          toast({ title: "入院記録に失敗しました", variant: "destructive" });
        },
        onSettled: () => setHospitalLoading(false),
      }
    );
  }

  function handleDischarge() {
    setHospitalLoading(true);
    updateMutation.mutate(
      { id, data: { hospitalizedAt: null, hospitalizedReason: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/residents"] });
          toast({ title: "退院として記録しました" });
        },
        onError: () => {
          toast({ title: "退院記録に失敗しました", variant: "destructive" });
        },
        onSettled: () => setHospitalLoading(false),
      }
    );
  }

  return (
    <Layout>
      {/* 退去確認ダイアログ */}
      {showMoveOutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-700">
              <DoorOpen className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold">退去処理</h2>
            </div>
            <p className="text-sm text-gray-500">
              {resident?.lastName} {resident?.firstName} さんを退去済みとして記録します。
              情報は5年間保管されます。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">退去日 <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">退去理由（任意）</label>
                <input
                  type="text"
                  value={moveOutReason}
                  onChange={(e) => setMoveOutReason(e.target.value)}
                  placeholder="例：入院、他施設への転居など"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowMoveOutDialog(false)}
                disabled={moveOutLoading}
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleMoveOut}
                disabled={!moveOutDate || moveOutLoading}
              >
                {moveOutLoading ? "処理中..." : "退去を記録する"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 入院確認ダイアログ */}
      {showHospitalDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Hospital className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-bold">入院記録</h2>
            </div>
            <p className="text-sm text-gray-500">
              {resident?.lastName} {resident?.firstName} さんの入院を記録します。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">入院日 <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={hospitalDate}
                  onChange={(e) => setHospitalDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">入院理由・入院先（任意）</label>
                <input
                  type="text"
                  value={hospitalReason}
                  onChange={(e) => setHospitalReason(e.target.value)}
                  placeholder="例：骨折、肺炎、定期検査など"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowHospitalDialog(false)}
                disabled={hospitalLoading}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                onClick={handleHospitalize}
                disabled={!hospitalDate || hospitalLoading}
              >
                {hospitalLoading ? "処理中..." : "入院を記録する"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/residents">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              利用者情報
            </h1>
          </div>
          {!isLoading && resident && !resident.movedOutAt && (
            <div className="flex items-center gap-2">
              {resident.hospitalizedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={handleDischarge}
                  disabled={hospitalLoading}
                >
                  <Hospital className="h-4 w-4" />
                  {hospitalLoading ? "処理中..." : "退院"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => setShowHospitalDialog(true)}
                >
                  <Hospital className="h-4 w-4" />
                  入院
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                onClick={() => setShowMoveOutDialog(true)}
              >
                <DoorOpen className="h-4 w-4" />
                退去
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-6 flex-1 min-h-0">
            <Skeleton className="h-full w-full rounded-xl" />
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ) : !resident || !summary ? (
          <div className="text-center py-12">見つかりませんでした</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-6 flex-1 min-h-0">
            {/* Left Pane: Resident Info */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
              {/* Basic Info Card */}
              <Card className="shrink-0 bg-primary/5 border-primary/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-2xl shrink-0">
                      {resident.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">{resident.roomNumber}</div>
                      <div className="font-bold text-xl">{resident.lastName} {resident.firstName}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{resident.gender}</div>
                    </div>
                  </div>
                  <div className="space-y-0 text-sm">
                    <div className="flex justify-between py-2 border-b border-primary/10">
                      <span className="text-muted-foreground">クリニック1</span>
                      <span className="font-medium text-right">{resident.clinic1 || "未登録"}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">クリニック2</span>
                      <span className="font-medium text-right">{resident.clinic2 || "未登録"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Keyperson & Care Manager Card */}
              <Card className="shrink-0">
                <CardHeader className="py-4 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    キーパーソン・ケアマネ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-5">
                  {/* Keyperson */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">キーパーソン</p>
                    <p className="text-sm font-semibold">
                      {resident.keyPersonRelation && (
                        <span className="text-xs text-muted-foreground mr-1.5">（{resident.keyPersonRelation}）</span>
                      )}
                      {resident.keyPersonName || "未登録"}
                    </p>
                    {resident.keyPersonAddress && (
                      <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{resident.keyPersonAddress}</span>
                      </div>
                    )}
                    {resident.keyPersonTel1 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{resident.keyPersonTel1}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">ケアマネ</p>
                    <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{resident.careManagerCompany || "未登録"}</span>
                    </div>
                    <p className="text-sm font-semibold">{resident.careManagerName || "未登録"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Medical Info Card */}
              <Card className="flex-1">
                <CardHeader className="py-4 pb-2">
                  <CardTitle className="text-base">医療情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pb-5">
                  <div>
                    <h3 className="text-sm font-bold text-muted-foreground mb-1">既往歴</h3>
                    <p className="text-sm whitespace-pre-wrap">{resident.medicalHistory || "なし"}</p>
                  </div>
                  <div className="pt-3 border-t">
                    <h3 className="text-sm font-bold text-primary mb-1">Dr.の指示</h3>
                    <p className="text-sm whitespace-pre-wrap bg-primary/5 p-3 rounded-md border border-primary/10">
                      {resident.doctorInstructions || "特になし"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Pane: Health Records Tabs */}
            <div className="flex flex-col h-full overflow-hidden">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <Tabs defaultValue="dr-report" className="flex-1 flex flex-col overflow-hidden p-4">
                  <TabsList className="grid w-full grid-cols-5 shrink-0">
                    <TabsTrigger value="dr-report" className="text-xs">Dr.報告</TabsTrigger>
                    <TabsTrigger value="vitals" className="text-xs">バイタル</TabsTrigger>
                    <TabsTrigger value="meals" className="text-xs">食事</TabsTrigger>
                    <TabsTrigger value="eliminations" className="text-xs">排泄</TabsTrigger>
                    <TabsTrigger value="weights" className="text-xs">体重</TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-y-auto mt-4 pr-1">
                    <TabsContent value="dr-report" className="m-0 space-y-3">
                      {(summary.doctorReports ?? []).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Dr.報告はありません</div>
                      ) : (
                        (summary.doctorReports ?? []).map((report) => (
                          <div key={report.id} className="p-4 rounded-lg border bg-card">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-primary">
                                {format(new Date(report.recordedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                              </span>
                              <span className="text-xs text-muted-foreground">{report.authorName}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{report.content}</p>
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="vitals" className="m-0 space-y-3">
                      {(summary.recentVitals ?? []).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">記録はありません</div>
                      ) : (
                        (summary.recentVitals ?? []).map((vital) => (
                          <div key={vital.id} className="p-4 rounded-lg border flex flex-col gap-2">
                            <div className="text-sm font-medium text-primary">
                              {format(new Date(vital.recordedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                              <span>KT: {vital.temperature || "-"}</span>
                              <span>BP: {vital.bpSystolic || "-"}/{vital.bpDiastolic || "-"}</span>
                              <span>P: {vital.pulse || "-"}</span>
                              <span>S: {vital.spo2 || "-"}</span>
                            </div>
                            {vital.isBath && (
                              <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit mt-1">
                                入浴: {vital.bathType}
                              </div>
                            )}
                            {vital.notes && <p className="text-sm text-muted-foreground mt-1">{vital.notes}</p>}
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="meals" className="m-0 space-y-3">
                      {(summary.recentMeals ?? []).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">記録はありません</div>
                      ) : (
                        (summary.recentMeals ?? []).map((meal) => (
                          <div key={meal.id} className="p-4 rounded-lg border flex justify-between items-center">
                            <div>
                              <div className="text-sm font-medium text-primary mb-1">
                                {format(new Date(meal.recordedAt), "yyyy/MM/dd", { locale: ja })} {meal.mealType}
                              </div>
                              <div className="text-sm">
                                {meal.waterOnly ? (
                                  <span className="text-blue-600">水分のみ</span>
                                ) : (
                                  <span>主菜: {meal.mainDishPercent}割 / 副菜: {meal.sideDishPercent}割</span>
                                )}
                              </div>
                            </div>
                            {meal.medicationOk && (
                              <div className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded font-bold border border-green-200">
                                服薬済
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="eliminations" className="m-0 space-y-3">
                      {(summary.recentEliminations ?? []).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">記録はありません</div>
                      ) : (
                        (summary.recentEliminations ?? []).map((elim) => (
                          <div key={elim.id} className="p-4 rounded-lg border">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-primary">
                                {format(new Date(elim.recordedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                              </span>
                              <span className="text-sm font-bold bg-muted px-2 py-0.5 rounded">{elim.type} - {elim.amount}</span>
                            </div>
                            {elim.notes && <p className="text-sm text-muted-foreground mt-2">{elim.notes}</p>}
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="weights" className="m-0 space-y-3">
                      {(summary.recentWeights ?? []).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">記録はありません</div>
                      ) : (
                        (summary.recentWeights ?? []).map((weight) => (
                          <div key={weight.id} className="p-4 rounded-lg border flex justify-between items-center">
                            <span className="text-sm font-medium text-primary">
                              {format(new Date(weight.recordedAt), "yyyy/MM/dd", { locale: ja })}
                            </span>
                            <span className="font-bold text-lg">{weight.weightKg} kg</span>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
