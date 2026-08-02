/**
 * The real backend's `validateImageDataUrl` (see the Lambda) only accepts
 * embedded base64 `data:image/...` strings — not plain https URLs. The
 * original zip's avatar presets/URL-entry modes pass raw https links, so
 * this converts them to a data URL before they're sent to PUT /me,
 * /tournaments/{id}/logo, etc. Already-a-data-URL values pass through
 * untouched.
 */
export async function toDataUrl(src: string): Promise<string> {
  if (!src) return '';
  if (src.startsWith('data:image/')) return src;

  const res = await fetch(src, { mode: 'cors' });
  if (!res.ok) throw new Error('Could not load that image URL.');
  const blob = await res.blob();

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) {
    throw new Error('Image must be PNG, JPEG, or WebP.');
  }
  // Matches the backend's 180,000-char cap on the encoded data URL string.
  if (blob.size > 130_000) {
    throw new Error('That image is too large — try a smaller preset or upload a compressed photo.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read that image.'));
    };
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(blob);
  });
}
