import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve to server/uploads directory
export const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface StorageConfig {
  provider: "supabase" | "s3" | "local";
  bucket: string;
  signedUrlExpirySeconds: number;
}

export const storageConfig: StorageConfig = {
  provider: (process.env.STORAGE_PROVIDER as any) || "local",
  bucket: process.env.STORAGE_BUCKET || "fitsyou-storage",
  signedUrlExpirySeconds: Number(process.env.SIGNED_URL_EXPIRY_SECONDS) || 900, // 15 mins
};

export interface SignedUploadUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface UploadResult {
  url: string;
  storageKey: string;
  storageProvider: "supabase" | "local";
}

/**
 * Generates a pre-signed direct upload URL for the client.
 */
export async function getSignedUploadUrl(
  userId: string,
  filename: string,
  contentType = "image/jpeg"
): Promise<SignedUploadUrlResult> {
  const ext = path.extname(filename) || ".jpg";
  const storageKey = `user-${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;

  // All browser uploads pass through the authenticated API route. This prevents exposing
  // storage credentials and lets uploadImage choose local or shared object storage.
  const apiBase = process.env.API_BASE_URL || "http://localhost:3000";
  const uploadUrl = `${apiBase}/api/v1/photos/direct-upload?key=${encodeURIComponent(storageKey)}`;

  return {
    uploadUrl,
    storageKey,
    expiresInSeconds: storageConfig.signedUrlExpirySeconds,
  };
}

/**
 * Generates a temporary signed read URL with short expiry (default 15 mins).
 */
export async function getSignedReadUrl(storageKey: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (storageConfig.provider === "supabase" && supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/sign/${storageConfig.bucket}/${storageKey}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expiresIn: storageConfig.signedUrlExpirySeconds }),
        }
      );
      if (res.ok) {
        const data: any = await res.json();
        return `${supabaseUrl}/storage/v1${data.signedURL}`;
      }
    } catch (e) {
      console.warn("Error signing Supabase read URL:", e);
    }
  }

  // Local storage resolution
  const apiBase = process.env.API_BASE_URL || "http://localhost:3000";
  return `${apiBase}/uploads/${storageKey}`;
}

/**
 * Uploads image buffer or base64 data to storage and returns storageKey and URL.
 */
export async function uploadImage(
  data: Buffer | string,
  storageKey: string,
  contentType = "image/jpeg"
): Promise<UploadResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const buffer =
    typeof data === "string" && data.startsWith("data:")
      ? Buffer.from(data.split(",")[1], "base64")
      : Buffer.isBuffer(data)
      ? data
      : Buffer.from(data);

  if (storageConfig.provider === "supabase" && supabaseUrl && supabaseKey) {
    const endpoint = `${supabaseUrl}/storage/v1/object/${storageConfig.bucket}/${storageKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        "Content-Type": contentType,
      },
      body: buffer,
    });

    if (res.ok) {
      const signedUrl = await getSignedReadUrl(storageKey);
      return {
        url: signedUrl,
        storageKey,
        storageProvider: "supabase",
      };
    }
  }

  // Local storage write
  const targetPath = path.resolve(UPLOADS_DIR, storageKey);
  const uploadsDir = path.dirname(targetPath);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, buffer);

  const apiBase = process.env.API_BASE_URL || "http://localhost:3000";
  return {
    url: `${apiBase}/uploads/${storageKey}`,
    storageKey,
    storageProvider: "local",
  };
}

/**
 * Permanently removes an object from storage.
 */
export async function deleteStorageObject(storageKey: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (storageConfig.provider === "supabase" && supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/storage/v1/object/${storageConfig.bucket}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefixes: [storageKey] }),
        }
      );
      return res.ok;
    } catch (e) {
      console.warn("Failed to delete Supabase storage object:", e);
    }
  }

  // Local storage deletion
  try {
    const filePath = path.resolve(UPLOADS_DIR, storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.warn("Failed to delete local storage file:", err);
  }

  return false;
}
