import type { APIRoute } from "astro";
import { rateLimit } from "../../../lib/auth/rate-limit";
import { requirePermission } from "../../../lib/auth/guard";
import { audit } from "../../../lib/audit";
import { run } from "../../../lib/db";
import { apiError, forbiddenOrigin, isSameOrigin, json } from "../../../lib/http";
import { inspectImage, isSafeImageSize } from "../../../lib/image";
import { publicMediaUrl, putMedia, usingR2 } from "../../../lib/media";

const MAX_BYTES = 500 * 1024;

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) return forbiddenOrigin();
  const guard = requirePermission(context, "media.write");
  if (guard.response) return guard.response;

  const limit = await rateLimit("media-upload", String(guard.admin.id), 30, 60 * 60);
  if (!limit.allowed) return apiError("Too many uploads. Try again later.", 429);

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return apiError("Expected a multipart image upload.");
  }

  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim();
  if (!(file instanceof File)) return apiError("Choose an image file.");
  if (!alt) return apiError("Alt text is mandatory for every image.");
  if (alt.length > 300) return apiError("Alt text must be 300 characters or fewer.");
  if (file.size === 0) return apiError("The image file is empty.");
  if (file.size > MAX_BYTES) return apiError("Image is larger than 500 KB. Compress it first.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = inspectImage(bytes);
  if (!image) return apiError("Only PNG, JPEG and WebP images are allowed.");
  if (!isSafeImageSize(image)) return apiError("Image dimensions are too large.");

  const id = crypto.randomUUID();
  const year = new Date().getUTCFullYear();
  const objectKey = `q/${year}/${crypto.randomUUID()}.${image.extension}`;

  try {
    await putMedia(objectKey, bytes, { mime: image.mime, alt, id });
    await run(
      `INSERT INTO media_assets
       (id, object_key, alt, mime_type, width, height, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      objectKey,
      alt,
      image.mime,
      image.width,
      image.height,
      bytes.byteLength,
      String(guard.admin.id),
    );
  } catch (error) {
    console.error("media upload failed", error);
    return apiError("Could not store the image.", 500);
  }

  await audit({
    adminId: guard.admin.id,
    action: "media.upload",
    entityType: "media_asset",
    entityId: null,
    diff: { id, objectKey, mime: image.mime, size: bytes.byteLength },
  });

  return json(
    {
      ok: true,
      id,
      url: publicMediaUrl(id, objectKey),
      storage: usingR2() ? "r2" : "kv",
      mime: image.mime,
      width: image.width,
      height: image.height,
      size: bytes.byteLength,
      alt,
    },
    201,
  );
};
