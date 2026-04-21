/**
 * Client-side image compression using the Canvas API.
 * Same approach used by Instagram and Twitter: resize + re-encode before upload.
 * - Resizes to max 1920×1920 preserving aspect ratio
 * - Encodes as WebP (best compression) with JPEG fallback
 * - Iteratively reduces quality if output exceeds maxSizeMB
 * - Returns the original file untouched if compression makes it larger
 * - GIFs are skipped entirely to preserve animation
 */
export async function compressImage(
  file: File,
  {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxSizeMB = 2,
  }: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeMB?: number;
  } = {}
): Promise<File> {
  if (file.type === "image/gif") return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      // White background so transparent PNGs don't become black when converted
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP (30-50% smaller than JPEG at same quality), fallback to JPEG
      const supportsWebP = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      const mime = supportsWebP ? "image/webp" : "image/jpeg";
      const ext = supportsWebP ? "webp" : "jpg";

      const attempt = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const sizeMB = blob.size / (1024 * 1024);
            if (sizeMB > maxSizeMB && q > 0.55) {
              attempt(Math.max(0.55, q - 0.1));
              return;
            }
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const compressed = new File([blob], `${baseName}.${ext}`, { type: mime });
            resolve(compressed.size < file.size ? compressed : file);
          },
          mime,
          q
        );
      };

      attempt(quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
