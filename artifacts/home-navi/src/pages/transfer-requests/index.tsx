import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import {
  useListTransferRequests,
  useCreateTransferRequest,
  useUpdateTransferRequest,
  useDeleteTransferRequest,
} from "@workspace/api-client-react";
import type {
  TransferRequest,
  CreateTransferRequestBody,
  UpdateTransferRequestBody,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTransferRequestsQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Building2,
  ExternalLink,
  Upload,
  Sparkles,
  Landmark,
  Loader2,
} from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ja } from "date-fns/locale";

const PAYER_COMPANIES = [
  "ハグライフ南摂津",
  "株式会社ハグライフ",
  "合同会社ケアサービス",
  "医療法人ハグメディカル",
  "社会福祉法人ハグ福祉会",
];

type SortMode = "due_date" | "payer_company";

function urgencyLabel(dueDate: string) {
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (days < 0) return { label: "期限超過", color: "bg-red-100 text-red-700" };
  if (days === 0) return { label: "本日期限", color: "bg-orange-100 text-orange-700" };
  if (days <= 3) return { label: `あと${days}日`, color: "bg-yellow-100 text-yellow-700" };
  return { label: `あと${days}日`, color: "bg-gray-100 text-gray-500" };
}

type FormState = {
  title: string;
  payeeCompany: string;
  payerCompany: string;
  dueDate: string;
  amount: string;
  requestedByName: string;
  bankInfo: string;
  notes: string;
  pdfUrl: string;
};

const emptyForm: FormState = {
  title: "",
  payeeCompany: "",
  payerCompany: "",
  dueDate: "",
  amount: "",
  requestedByName: "",
  bankInfo: "",
  notes: "",
  pdfUrl: "",
};

// Fields highlighted by AI extraction
type AiFilledFields = Set<keyof FormState>;

export default function TransferRequestsPage() {
  const queryClient = useQueryClient();
  const [sortMode, setSortMode] = useState<SortMode>("due_date");
  const [filterStatus, setFilterStatus] = useState<"全て" | "未処理" | "処理済">("全て");

  const { data: allRequests = [] } = useListTransferRequests(
    { sort: sortMode },
    { query: { queryKey: getListTransferRequestsQueryKey({ sort: sortMode }) } },
  );

  const createMutation = useCreateTransferRequest();
  const updateMutation = useUpdateTransferRequest();
  const deleteMutation = useDeleteTransferRequest();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TransferRequest | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [aiFilledFields, setAiFilledFields] = useState<AiFilledFields>(new Set());
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries();

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setAiFilledFields(new Set());
    setModalOpen(true);
  }

  function openEdit(req: TransferRequest) {
    setEditing(req);
    setForm({
      title: req.title,
      payeeCompany: req.payeeCompany,
      payerCompany: req.payerCompany,
      dueDate: req.dueDate,
      amount: req.amount != null ? String(req.amount) : "",
      requestedByName: req.requestedByName,
      bankInfo: req.bankInfo ?? "",
      notes: req.notes ?? "",
      pdfUrl: req.pdfUrl ?? "",
    });
    setAiFilledFields(new Set());
    setModalOpen(true);
  }

  // Upload file and optionally store URL
  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/transfer-requests/upload-file", {
        method: "POST",
        body: fd,
      });
      const data = await resp.json();
      if (data.fileUrl) {
        setForm((f) => ({ ...f, pdfUrl: data.fileUrl }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // AI analyze: read the file and pre-fill form
  async function handleAnalyzeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    try {
      // Upload for storage
      const fd1 = new FormData();
      fd1.append("file", file);
      const uploadResp = await fetch("/api/transfer-requests/upload-file", {
        method: "POST",
        body: fd1,
      });
      const uploadData = await uploadResp.json();

      // Analyze with AI
      const fd2 = new FormData();
      fd2.append("file", file);
      const analyzeResp = await fetch("/api/transfer-requests/analyze-file", {
        method: "POST",
        body: fd2,
      });
      const ai = await analyzeResp.json();

      // Apply extracted fields and track which ones AI filled
      const filled: AiFilledFields = new Set();
      setForm((prev) => {
        const next = { ...prev };

        if (uploadData.fileUrl) next.pdfUrl = uploadData.fileUrl;

        if (ai.title) { next.title = ai.title; filled.add("title"); }
        if (ai.payeeCompany) { next.payeeCompany = ai.payeeCompany; filled.add("payeeCompany"); }
        if (ai.dueDate) { next.dueDate = ai.dueDate; filled.add("dueDate"); }
        if (ai.amount) { next.amount = String(ai.amount); filled.add("amount"); }
        if (ai.bankInfo) { next.bankInfo = ai.bankInfo; filled.add("bankInfo"); }
        if (ai.notes) { next.notes = ai.notes; filled.add("notes"); }

        return next;
      });
      setAiFilledFields(filled);
    } catch {
      // silently ignore - user can fill manually
    } finally {
      setAnalyzing(false);
      if (analyzeInputRef.current) analyzeInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    const body = {
      title: form.title,
      payeeCompany: form.payeeCompany,
      payerCompany: form.payerCompany,
      dueDate: form.dueDate,
      amount: form.amount ? parseInt(form.amount, 10) : null,
      requestedByName: form.requestedByName,
      bankInfo: form.bankInfo || null,
      notes: form.notes || null,
      pdfUrl: form.pdfUrl || null,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: body as UpdateTransferRequestBody },
        { onSuccess: () => { invalidate(); setModalOpen(false); } },
      );
    } else {
      createMutation.mutate(
        { data: body as CreateTransferRequestBody },
        { onSuccess: () => { invalidate(); setModalOpen(false); } },
      );
    }
  }

  function handleMarkPaid(req: TransferRequest) {
    updateMutation.mutate(
      { id: req.id, data: { status: req.status === "処理済" ? "未処理" : "処理済" } },
      { onSuccess: invalidate },
    );
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); setDeleteTarget(null); } });
  }

  const filtered = (filterStatus === "全て"
    ? allRequests
    : allRequests.filter((r) => r.status === filterStatus)) as TransferRequest[];

  const unpaidCount = (allRequests as TransferRequest[]).filter((r) => r.status === "未処理").length;
  const overdueCount = (allRequests as TransferRequest[]).filter((r) =>
    r.status === "未処理" && differenceInCalendarDays(parseISO(r.dueDate), new Date()) < 0,
  ).length;

  // Helper: highlight field border if AI filled it
  function aiClass(field: keyof FormState) {
    return aiFilledFields.has(field)
      ? "border-purple-400 bg-purple-50 focus:border-purple-500"
      : "";
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">振込依頼</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              未処理 {unpaidCount}件
              {overdueCount > 0 && (
                <span className="ml-2 text-red-600 font-semibold">期限超過 {overdueCount}件</span>
              )}
            </p>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            新規依頼
          </Button>
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(["全て", "未処理", "処理済"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortMode((m) => m === "due_date" ? "payer_company" : "due_date")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortMode === "due_date" ? "期限順" : "支払元順"}
          </button>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">振込依頼がありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((req) => {
              const urgency = urgencyLabel(req.dueDate);
              const isPaid = req.status === "処理済";
              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-xl border p-4 shadow-sm transition-all ${
                    isPaid ? "opacity-60 border-gray-100" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Paid toggle */}
                    <button
                      onClick={() => handleMarkPaid(req)}
                      className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 transition-colors ${
                        isPaid
                          ? "border-green-500 bg-green-500 flex items-center justify-center"
                          : "border-gray-300 hover:border-green-400"
                      }`}
                      title={isPaid ? "未処理に戻す" : "処理済にする"}
                    >
                      {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isPaid ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {req.title}
                        </span>
                        <Badge variant={isPaid ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0">
                          {req.status}
                        </Badge>
                        {!isPaid && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${urgency.color}`}>
                            {urgency.label}
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="mt-1.5 space-y-1 text-xs text-gray-500">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                          <span className="flex items-center gap-1 min-w-0">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="text-gray-400">支払先:</span>
                            <span className="font-medium text-gray-700 truncate">{req.payeeCompany}</span>
                          </span>
                          <span className="flex items-center gap-1 min-w-0">
                            <Building2 className="h-3 w-3 shrink-0 text-primary" />
                            <span className="text-gray-400">支払元:</span>
                            <span className="font-medium text-gray-700 truncate">{req.payerCompany}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="text-gray-400">期限:</span>
                            <span className="font-medium text-gray-700">
                              {format(parseISO(req.dueDate), "yyyy年M月d日（E）", { locale: ja })}
                            </span>
                          </span>
                          {req.amount != null && (
                            <span className="font-medium text-gray-700">¥{req.amount.toLocaleString()}</span>
                          )}
                        </div>
                        {req.bankInfo && (
                          <div className="flex items-start gap-1 bg-blue-50 rounded px-2 py-1">
                            <Landmark className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                            <span className="text-blue-700 font-medium">{req.bankInfo}</span>
                          </div>
                        )}
                        <div className="text-gray-400">
                          依頼者: {req.requestedByName}
                          {" · "}
                          {format(parseISO(req.createdAt), "M/d", { locale: ja })}登録
                        </div>
                      </div>

                      {req.notes && (
                        <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{req.notes}</p>
                      )}

                      {req.pdfUrl && (
                        <a
                          href={req.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          添付ファイルを開く
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(req)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(req.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "振込依頼を編集" : "振込依頼を新規作成"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* AI Scan button — primary CTA at the top */}
            <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 p-3">
              <input
                ref={analyzeInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleAnalyzeFile}
              />
              <button
                type="button"
                onClick={() => analyzeInputRef.current?.click()}
                disabled={analyzing}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-purple-700 hover:text-purple-800 transition-colors disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AIが読み取り中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    請求書・領収書をAIで読み取る
                  </>
                )}
              </button>
              {aiFilledFields.size > 0 && (
                <p className="text-center text-xs text-purple-600 mt-1">
                  ✓ {aiFilledFields.size}項目を自動入力しました（紫色のフィールド）
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>件名 <span className="text-red-500">*</span></Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="例：〇〇社 請求書 6月分"
                className={aiClass("title")}
              />
            </div>

            {/* Payee company */}
            <div className="space-y-1.5">
              <Label>支払先（請求元の会社） <span className="text-red-500">*</span></Label>
              <Input
                value={form.payeeCompany}
                onChange={(e) => setForm((f) => ({ ...f, payeeCompany: e.target.value }))}
                placeholder="例：株式会社〇〇"
                className={aiClass("payeeCompany")}
              />
            </div>

            {/* Payer company */}
            <div className="space-y-1.5">
              <Label>支払元の会社 <span className="text-red-500">*</span></Label>
              <Select
                value={form.payerCompany}
                onValueChange={(v) => setForm((f) => ({ ...f, payerCompany: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="支払元を選択..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYER_COMPANIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>振込期限 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className={aiClass("dueDate")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>金額（円）</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="例：50000"
                  className={aiClass("amount")}
                />
              </div>
            </div>

            {/* Bank info */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Landmark className="h-3.5 w-3.5 text-blue-500" />
                振込先口座情報
              </Label>
              <Input
                value={form.bankInfo}
                onChange={(e) => setForm((f) => ({ ...f, bankInfo: e.target.value }))}
                placeholder="例：三菱UFJ銀行 梅田支店 普通 1234567 ハグライフ"
                className={aiClass("bankInfo")}
              />
            </div>

            {/* Requested by */}
            <div className="space-y-1.5">
              <Label>依頼者名 <span className="text-red-500">*</span></Label>
              <Input
                value={form.requestedByName}
                onChange={(e) => setForm((f) => ({ ...f, requestedByName: e.target.value }))}
                placeholder="例：山田 花子"
              />
            </div>

            {/* PDF Upload */}
            <div className="space-y-1.5">
              <Label>ファイル添付（参照用）</Label>
              <div className="flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={handleUploadFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "アップロード中..." : "ファイルを選択"}
                </Button>
                {form.pdfUrl && (
                  <a
                    href={form.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    確認
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>備考</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="備考・メモ"
                rows={2}
                className={aiClass("notes")}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                キャンセル
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={
                  !form.title ||
                  !form.payeeCompany ||
                  !form.payerCompany ||
                  !form.dueDate ||
                  !form.requestedByName ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
              >
                {editing ? "更新する" : "登録する"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>振込依頼を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget !== null && handleDelete(deleteTarget)}
              className="bg-red-500 hover:bg-red-600"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
