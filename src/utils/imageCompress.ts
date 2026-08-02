/**
 * Photos are stored as base64 text directly inside a DynamoDB item — no
 * S3, no separate file storage. DynamoDB caps every item at 400KB total,
 * which a 1MB photo (≈1.37MB once base64-encoded) would blow straight
 * through. Rather than reject anything over a tiny size limit, this
 * resizes and re-encodes the image client-side so any reasonably-sized
 * photo (up to MAX_ACCEPT_BYTES) ends up well under the backend's cap
 * regardless of how large the original file was.
 */

export const MAX_ACCEPT_BYTES = 1024 * 1024; // 1MB — the largest source file this accepts
const TARGET_MAX_DATA_URL_LENGTH = 150_000; // stays safely under the backend's 180,000-char cap
const MAX_DIMENSION = 480; // px, long edge — plenty for an avatar/logo, keeps output small

export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }
  if (file.size > MAX_ACCEPT_BYTES) {
    throw new Error('Image is too large — please choose a photo under 1MB.');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image.');
  ctx.drawImage(img, 0, 0, width, height);

  // Step quality down until the encoded result fits comfortably under
  // the backend's limit — starts high, only degrades as much as needed.
  let quality = 0.9;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (output.length > TARGET_MAX_DATA_URL_LENGTH && quality > 0.3) {
    quality -= 0.1;
    output = canvas.toDataURL('image/jpeg', quality);
  }

  if (output.length > TARGET_MAX_DATA_URL_LENGTH) {
    throw new Error('Could not compress this image small enough — try a smaller or simpler photo.');
  }

  return output;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read file.')));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = src;
  });
}
