import { Layout } from "@/components/layout";
import { useGetResident } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, User, Phone, Home, FileText, DoorOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function MovedOutDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");

  const { data: resident, isLoading } = useGetResident(id, { query: { enabled: !!id } });

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/residents/moved-out">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">退去者情報</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !resident ? (
          <div className="text-center py-12">見つかりませんでした</div>
        ) : (
          <div className="space-y-6">
            {/* 退去情報バナー */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <DoorOpen className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-600">退去済み</p>
                <p className="text-sm text-gray-500">
                  退去日：
                  {resident.movedOutAt
                    ? format(new Date(resident.movedOutAt), "yyyy年M月d日（EE）", { locale: ja })
                    : "—"}
                  {resident.movedOutReason && `　理由：${resident.movedOutReason}`}
                </p>
              </div>
            </div>

            {/* プロフィール */}
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="h-24 w-24 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-4xl shrink-0">
                  {resident.lastName.charAt(0)}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4 mb-2">
                    <span className="text-lg font-medium text-muted-foreground">{resident.roomNumber}</span>
                    <h2 className="text-3xl font-bold">{resident.lastName} {resident.firstName}</h2>
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    {resident.lastNameKana} {resident.firstNameKana} / {resident.lastNameRoman} {resident.firstNameRoman}
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-sm font-medium">
                    <span>{resident.gender}</span>
                    <span>{resident.birthEra}{resident.birthYear}年{resident.birthMonth}月{resident.birthDay}日</span>
                    <span>要介護度: <span className="text-gray-600">{resident.careLevel}</span></span>
                    {resident.stomaManagement && (
                      <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded">排泄管理</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="py-4 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    人物像・留意点
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-muted-foreground mb-1">どんな人物か</p>
                    <p className="text-sm whitespace-pre-wrap">{resident.characterNotes || "未登録"}</p>
                  </div>
                  {resident.moveInDate && (
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1">入居日</p>
                      <p className="text-sm">{format(new Date(resident.moveInDate), "yyyy年MM月dd日", { locale: ja })}</p>
                    </div>
                  )}
                  {resident.movedOutAt && (
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />退去日
                      </p>
                      <p className="text-sm">{format(new Date(resident.movedOutAt), "yyyy年MM月dd日", { locale: ja })}</p>
                      {resident.movedOutReason && (
                        <p className="text-sm text-gray-500 mt-1">理由：{resident.movedOutReason}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-4 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    キーパーソン・関係者
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-bold text-muted-foreground mb-1">キーパーソン</p>
                    <div className="text-sm">
                      <span className="font-bold">{resident.keyPersonName || "未登録"}</span>
                      {resident.keyPersonRelation && (
                        <span className="ml-2 text-muted-foreground">({resident.keyPersonRelation})</span>
                      )}
                    </div>
                  </div>

                  {resident.keyPersonTel1 && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${resident.keyPersonTel1}`} className="text-sm text-primary hover:underline">
                        {resident.keyPersonTel1}
                      </a>
                    </div>
                  )}

                  {resident.keyPersonAddress && (
                    <div className="flex items-start gap-2">
                      <Home className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-sm">{resident.keyPersonAddress}</span>
                    </div>
                  )}

                  {resident.keyPersonMemo && (
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1">メモ</p>
                      <p className="text-sm whitespace-pre-wrap">{resident.keyPersonMemo}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t mt-4">
                    <p className="text-sm font-bold text-muted-foreground mb-1">担当ケアマネジャー</p>
                    <p className="text-sm">
                      {resident.careManagerCompany} {resident.careManagerName}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 医療情報 */}
              {(resident.clinic1 || resident.clinic2 || resident.medicalHistory) && (
                <Card className="md:col-span-2">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      医療情報
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {resident.clinic1 && (
                        <div>
                          <p className="text-sm font-bold text-muted-foreground mb-1">クリニック1</p>
                          <p className="text-sm">{resident.clinic1}</p>
                        </div>
                      )}
                      {resident.clinic2 && (
                        <div>
                          <p className="text-sm font-bold text-muted-foreground mb-1">クリニック2</p>
                          <p className="text-sm">{resident.clinic2}</p>
                        </div>
                      )}
                    </div>
                    {resident.medicalHistory && (
                      <div>
                        <p className="text-sm font-bold text-muted-foreground mb-1">既往歴</p>
                        <p className="text-sm whitespace-pre-wrap">{resident.medicalHistory}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
