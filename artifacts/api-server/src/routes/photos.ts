import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { promises as fs } from "fs";
import path from "path";

const router = Router();
const connectors = new ReplitConnectors();
const CACHE_DIR = "/tmp/photo_cache";

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}
ensureCacheDir();

router.get("/photos/:fileId", async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || !/^[\w\-]+$/.test(fileId)) {
    return res.status(400).json({ error: "Invalid file ID" });
  }

  const cachePath = path.join(CACHE_DIR, fileId);

  try {
    // キャッシュ確認
    try {
      const cached = await fs.readFile(cachePath);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-Cache", "HIT");
      return res.end(cached);
    } catch {
      // キャッシュなし → Google Driveから取得
    }

    const driveRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files/${fileId}?alt=media`,
      { method: "GET" }
    );
    if (!driveRes.ok) {
      return res.status(driveRes.status).json({ error: "Failed to fetch photo" });
    }
    const contentType = driveRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await driveRes.arrayBuffer());

    // ディスクにキャッシュ
    fs.writeFile(cachePath, buffer).catch(() => {});

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Cache", "MISS");
    return res.end(buffer);
  } catch (err) {
    req.log.error({ err }, "Photo proxy error");
    return res.status(500).json({ error: "Photo proxy error" });
  }
});

export default router;
