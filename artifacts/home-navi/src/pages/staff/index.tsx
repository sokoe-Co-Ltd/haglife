import { Layout } from "@/components/layout";
import { useListStaff, useUpdateStaff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, Plus, Phone, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { StaffMemoCard } from "@/components/PageRightPanel";

export default function StaffList() {
  const { data: staff, isLoading } = useListStaff();
  const updateStaff = useUpdateStaff();
  const queryClient = useQueryClient();

  function toggleVisible(id: number, current: boolean) {
    updateStaff.mutate(
      { id, data: { isVisible: !current } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
        },
      }
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            職員一覧
            {staff && (
              <span className="text-sm font-normal text-gray-500 ml-1">
                （{staff.length}名）
              </span>
            )}
          </h1>
          <Link href="/staff/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              新規登録
            </Button>
          </Link>
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {staff?.slice().sort((a, b) => Number(b.isVisible) - Number(a.isVisible)).map((person) => (
                  <div
                    key={person.id}
                    className={`flex items-center justify-between px-4 py-3.5 transition-colors ${
                      person.isVisible ? "hover:bg-gray-50" : "bg-gray-50/70 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${
                          person.isVisible
                            ? "bg-primary/10 text-primary"
                            : "bg-gray-200 text-gray-400"
                        }`}
                      >
                        {person.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {person.lastName} {person.firstName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{person.role}</p>
                        {person.tel && (
                          <p className="text-xs text-gray-400 mt-0.5">{person.tel}</p>
                        )}
                        {!person.isVisible && (
                          <span className="text-xs text-gray-400 italic">非表示中</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {person.tel && person.isVisible && (
                        <a href={`tel:${person.tel}`}>
                          <button className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                            <Phone className="h-4 w-4" />
                          </button>
                        </a>
                      )}
                      <button
                        onClick={() => toggleVisible(person.id, person.isVisible)}
                        title={person.isVisible ? "非表示にする" : "表示する"}
                        className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                          person.isVisible
                            ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                      >
                        {person.isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden lg:flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">表示設定について</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                非表示にした職員は、申し送りなどの記入者選択に表示されなくなります。退職者や不要な職員を非表示にしてください。
              </p>
            </div>
            <StaffMemoCard memo="連絡先の変更がある場合は、速やかに更新してください。" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
