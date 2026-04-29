import { Layout } from "@/components/layout";
import { useGetResident } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, User, Phone, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function ResidentDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: resident, isLoading } = useGetResident(id, { query: { enabled: !!id } });

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/residents">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">利用者情報</h1>
          </div>
          <Link href={`/health/${id}`}>
             <Button variant="outline" className="text-primary border-primary">健康管理画面へ</Button>
          </Link>
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
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className={`h-24 w-24 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-4xl shrink-0 ${resident.gender === "男性" ? "ring-4 ring-blue-400" : "ring-4 ring-red-400"}`}>
                  {resident.lastName.charAt(0)}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4 mb-2">
                    <span className="text-lg font-medium text-muted-foreground">{resident.roomNumber}</span>
                    <h2 className="text-3xl font-bold">{resident.lastName} {resident.firstName}様</h2>
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    {resident.lastNameKana} {resident.firstNameKana} / {resident.lastNameRoman} {resident.firstNameRoman}
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-sm font-medium">
                    <span>{resident.gender}</span>
                    <span>{resident.birthEra}{resident.birthYear}年{resident.birthMonth}月{resident.birthDay}日</span>
                    <span>要介護度: <span className="text-primary">{resident.careLevel}</span></span>
                    {resident.stomaManagement && <span className="text-primary bg-primary/10 px-2 py-0.5 rounded">排泄管理</span>}
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
                      {resident.keyPersonRelation && <span className="ml-2 text-muted-foreground">({resident.keyPersonRelation})</span>}
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
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
