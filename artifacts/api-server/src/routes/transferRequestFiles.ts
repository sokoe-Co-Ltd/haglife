import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";

const UPLOAD_DIR = "/home/runner/workspace/data/transfer-request-files";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, `transfer_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.mimetype.startsWith("image/");
    if (ok) cb(null, true);
    else cb(new Error("PDFまたは画像ファイルのみアップロード可能です"));
  },
});

const router: IRouter = Router();

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}
ensureUploadDir();

router.post(
  "/transfer-requests/upload-file",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "ファイルが選択されていません" });
    }
    const fileUrl = `/api/transfer-request-files/${req.file.filename}`;
    return res.json({ fileUrl });
  },
);

router.get("/transfer-request-files/:filename", async (req, res) => {
  const { filename } = req.params;
  if (!/^[\w\-\.]+$/.test(filename)) return res.status(400).end();
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.access(filePath);
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".pdf") {
      res.setHeader("Content-Type", "application/pdf");
    }
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(filePath);
  } catch {
    return res.status(404).end();
  }
});

export default router;
