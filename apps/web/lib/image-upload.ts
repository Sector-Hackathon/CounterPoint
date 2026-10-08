/**
 * Large screenshots are re-encoded before upload. Through the deployed /api proxy a request body
 * is limited to about 4.5 MB, and base64 makes an image a third larger.
 */
const SHRINK_ABOVE_BYTES = 2_000_000;
const MAX_SIDE = 2000;

export function needsShrinking(bytes: number): boolean {
  return bytes > SHRINK_ABOVE_BYTES;
}

/** The size to draw at: long side at most 2000 px (enough to read text), never enlarged. */
export function shrunkSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** The image to upload: the file itself, or a smaller JPEG of it when it is large. Browser only. */
export async function imageForUpload(file: File): Promise<Blob> {
  if (!needsShrinking(file.size)) return file;
  const bitmap = await createImageBitmap(file);
  const { width, height } = shrunkSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return jpeg && jpeg.size < file.size ? jpeg : file;
}
