/**
 * The image in a paste, when the paste is a picture rather than text. Copies that carry both
 * (a spreadsheet range comes with a picture of itself) are text, so the normal paste happens.
 */
export function pastedImage<F extends { type: string }>(data: { files: ArrayLike<F>; types: readonly string[] }): F | null {
  if (data.types.includes('text/plain')) return null;
  return Array.from(data.files).find((f) => f.type.startsWith('image/')) ?? null;
}
