// ─── Attachment storage (local disk or S3-compatible object storage) ──────────
// Linkloop Pro media & voice files are PRIVATE: they are persisted here and only
// ever served back through the auth + membership-gated /api/attachments/:id
// stream route — never via a public bucket URL. Two drivers:
//   • disk  (default; local dev)     — files under server/uploads/
//   • s3    (production)             — any S3-compatible bucket: AWS S3,
//                                       Cloudflare R2, Backblaze B2, MinIO…
// The driver is chosen by STORAGE_DRIVER, or auto-detected as "s3" when S3_BUCKET
// is set. Use "s3" on ephemeral hosts (e.g. Render's free tier wipes the local
// disk on every restart/redeploy) so uploaded media survives. Mirrors the
// VAPID/SMTP "configured or graceful default" pattern: no S3 vars → plain disk.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "uploads");

export const storageDriver = (
  process.env.STORAGE_DRIVER || (process.env.S3_BUCKET ? "s3" : "disk")
).toLowerCase();

const S3_BUCKET = process.env.S3_BUCKET;
// Keys are namespaced under a prefix so the bucket can be shared with other data.
const S3_PREFIX = (process.env.S3_PREFIX ?? "attachments").replace(/^\/+|\/+$/g, "");

let s3 = null;
let sdk = null;

if (storageDriver === "s3") {
  if (!S3_BUCKET) {
    throw new Error("[storage] STORAGE_DRIVER=s3 but S3_BUCKET is not set");
  }
  // Imported lazily so a disk-only deployment never loads the AWS SDK.
  sdk = await import("@aws-sdk/client-s3");
  s3 = new sdk.S3Client({
    // R2 ignores region (use "auto"); real AWS S3 needs its bucket region.
    region: process.env.S3_REGION || "auto",
    // Set for R2/MinIO/B2 (e.g. https://<account>.r2.cloudflarestorage.com).
    // Leave blank for AWS S3 so the SDK derives the regional endpoint.
    endpoint: process.env.S3_ENDPOINT || undefined,
    // Path-style is required by most non-AWS S3 endpoints; default it on when a
    // custom endpoint is configured unless explicitly turned off.
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE === "true" ||
      (!!process.env.S3_ENDPOINT && process.env.S3_FORCE_PATH_STYLE !== "false"),
    // Explicit keys, or fall back to the default AWS credential chain (IAM role).
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  console.log(
    `[storage] object storage → bucket "${S3_BUCKET}"` +
      (process.env.S3_ENDPOINT ? ` @ ${process.env.S3_ENDPOINT}` : "") +
      (S3_PREFIX ? ` (prefix "${S3_PREFIX}/")` : ""),
  );
} else {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[storage] local disk → ${UPLOAD_DIR}`);
}

const objectKey = (key) => (S3_PREFIX ? `${S3_PREFIX}/${key}` : key);
const diskPath = (key) => path.join(UPLOAD_DIR, path.basename(key));

// Random stored name; a short sanitized extension preserves content-type hints.
export function generateKey(originalname = "") {
  const ext = path.extname(originalname).slice(0, 12).replace(/[^.a-zA-Z0-9]/g, "");
  return `${randomUUID()}${ext}`;
}

// Persist a validated buffer under `key`. Called only after the route's plan and
// size checks pass, so nothing is ever written for a rejected upload.
export async function putObject({ key, buffer, mime }) {
  if (storageDriver === "s3") {
    await s3.send(
      new sdk.PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: objectKey(key),
        Body: buffer,
        ContentType: mime,
        CacheControl: "private, max-age=86400",
      }),
    );
  } else {
    await fs.promises.writeFile(diskPath(key), buffer);
  }
}

// Pipe a stored object to an Express response. The caller has already set the
// response headers and done the auth + membership check; a missing object yields
// a bare 404 (never leaks bucket/path details).
export async function streamObject(key, res) {
  if (storageDriver === "s3") {
    try {
      const out = await s3.send(
        new sdk.GetObjectCommand({ Bucket: S3_BUCKET, Key: objectKey(key) }),
      );
      out.Body.on("error", () => {
        if (!res.headersSent) res.status(500).end();
      }).pipe(res);
    } catch {
      if (!res.headersSent) res.status(404).end();
    }
  } else {
    fs.createReadStream(diskPath(key))
      .on("error", () => {
        if (!res.headersSent) res.status(404).end();
      })
      .pipe(res);
  }
}

// Best-effort delete; safe to call when the object may already be gone.
export async function deleteObject(key) {
  if (!key) return;
  try {
    if (storageDriver === "s3") {
      await s3.send(
        new sdk.DeleteObjectCommand({ Bucket: S3_BUCKET, Key: objectKey(key) }),
      );
    } else {
      await fs.promises.unlink(diskPath(key));
    }
  } catch {
    /* already removed — ignore */
  }
}
