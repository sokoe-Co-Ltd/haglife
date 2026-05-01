import { Router } from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";

const UPLOAD_DIR = "/home/runner/workspace/data/elimination-photos";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `elim_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("画像ファイルのみアップロード可能です"));
  },
});

const router = Router();

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}
ensureUploadDir();

router.post(
  "/eliminations/upload-photo",
  upload.single("photo"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "ファイルが選択されていません" });
    const photoUrl = `/api/elimination-photos/${req.file.filename}`;
    return res.json({ photoUrl });
  }
);

router.get("/elimination-photos/:filename", async (req, res) => {
  const { filename } = req.params;
  if (!/^[\w\-\.]+$/.test(filename)) return res.status(400).end();
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.access(filePath);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(filePath);
  } catch {
    return res.status(404).end();
  }
});

export default router;
