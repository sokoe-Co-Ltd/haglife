import { Layout } from "@/components/layout";
import { useGetStaff } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Phone, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";

export default function StaffDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: staff, isLoading } = useGetStaff(id, { query: { enabled: !!id } });

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">職員詳細</h1>
        </div>

        {isLoading ? (
           <Card>
             <CardContent className="p-6">
                <Skeleton className="h-32 w-full" />
             </CardContent>
           </Card>
        ) : !staff ? (
           <div className="text-center py-12">見つかりませんでした</div>
        ) : (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-4xl mb-4">
                {staff.lastName.charAt(0)}
              </div>
              <CardTitle className="text-2xl">{staff.lastName} {staff.firstName}</CardTitle>
              <div className="text-muted-foreground mt-1">
                {staff.lastNameKana} {staff.firstNameKana}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="flex justify-center mb-6">
                <span className="bg-primary/10 text-primary px-4 py-1 rounded-full text-sm font-bold">
                  {staff.role}
                </span>
                {!staff.isVisible && (
                  <span className="bg-muted text-muted-foreground px-4 py-1 rounded-full text-sm font-bold ml-2">
                    非表示（非アクティブ）
                  </span>
                )}
              </div>

              <div className="space-y-4 pt-6 border-t">
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    連絡先
                  </h3>
                  {staff.tel ? (
                    <div className="flex items-center justify-between bg-secondary/50 p-4 rounded-lg">
                      <span className="text-lg font-medium">{staff.tel}</span>
                      <a href={`tel:${staff.tel}`}>
                        <Button>発信</Button>
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">登録されていません</p>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
