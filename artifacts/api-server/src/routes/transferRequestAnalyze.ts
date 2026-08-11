import { Router, type IRouter } from "express";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.mimetype.startsWith("image/");
    if (ok) cb(null, true);
    else cb(new Error("PDFまたは画像ファイルのみ対応しています"));
  },
});

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const EXTRACT_PROMPT = `
この画像（または文書テキスト）は日本語の請求書・領収書です。
以下のフィールドを抽出してJSONで返してください。見つからない場合はnullにしてください。

{
  "title": "文書の件名・タイトル（例：〇〇社 6月分請求書）",
  "payeeCompany": "請求元の会社名（振込先の会社名）",
  "dueDate": "振込期限の日付（YYYY-MM-DD形式。「令和」表記も西暦に変換する）",
  "amount": "振込金額（整数、円単位。税込みがあれば税込みを優先。数字のみ）",
  "bankName": "銀行名（例：三菱UFJ銀行）",
  "branchName": "支店名（例：梅田支店）",
  "accountType": "口座種別（普通 または 当座）",
  "accountNumber": "口座番号（数字のみ）",
  "accountHolder": "口座名義（カタカナ）",
  "notes": "その他メモとして有用な情報（振込人名義の指定など）"
}

必ずJSONのみを返してください。説明文やマークダウンコードブロックは不要です。
`.trim();

router.post(
  "/transfer-requests/analyze-file",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "ファイルが選択されていません" });
    }

    const client = getOpenAIClient();
    let result: Record<string, string | number | null>;

    try {
      if (req.file.mimetype === "application/pdf") {
        // PDF: extract text with pdf-parse, then send as text to GPT
        const pdfMod = await import("pdf-parse");
        const pdfParse = (pdfMod as any).default ?? pdfMod;
        const pdfData = await pdfParse(req.file.buffer);
        const text = pdfData.text.slice(0, 8000); // trim to avoid token limits

        const completion = await client.chat.completions.create({
          model: "gpt-5.6-luna",
          messages: [
            {
              role: "user",
              content: `${EXTRACT_PROMPT}\n\n--- 文書テキスト ---\n${text}`,
            },
          ],
          temperature: 0,
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        result = JSON.parse(raw);
      } else {
        // Image: send as base64 vision input
        const base64 = req.file.buffer.toString("base64");
        const mime = req.file.mimetype;

        const completion = await client.chat.completions.create({
          model: "gpt-5.6-luna",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: EXTRACT_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:${mime};base64,${base64}` },
                },
              ],
            },
          ],
          temperature: 0,
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        result = JSON.parse(raw);
      }

      // Normalize amount
      if (result.amount !== null && result.amount !== undefined) {
        const n = parseInt(String(result.amount).replace(/[^0-9]/g, ""), 10);
        result.amount = isNaN(n) ? null : n;
      }

      // Format bank info as a readable string
      const parts: string[] = [];
      if (result.bankName) parts.push(String(result.bankName));
      if (result.branchName) parts.push(String(result.branchName));
      if (result.accountType) parts.push(String(result.accountType));
      if (result.accountNumber) parts.push(`口座番号: ${result.accountNumber}`);
      if (result.accountHolder) parts.push(`名義: ${result.accountHolder}`);
      result.bankInfo = parts.length > 0 ? parts.join(" ／ ") : null;

      return res.json(result);
    } catch (err) {
      req.log?.error(err, "analyze-file failed");
      return res.status(500).json({ error: "AIによる読み取りに失敗しました" });
    }
  },
);

export default router;
