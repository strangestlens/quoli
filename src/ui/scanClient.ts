import { validateScan, type ScannedSet, type ScanResponse } from '../game/scan.ts';

/** Longest edge sent to the reader. Bigger costs tokens without helping. */
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.82;

export type ScanOutcome =
  | { readonly ok: true; readonly value: ScannedSet }
  | { readonly ok: false; readonly message: string };

/**
 * Shrink a camera photo before upload.
 *
 * `imageOrientation: 'from-image'` is load-bearing, not tidiness: phone photos
 * carry their rotation in EXIF rather than in the pixels, and the reader is
 * told that every die's orientation is what distinguishes N from Z. Uploading
 * pixels that haven't had EXIF applied would rotate the whole board.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('could not encode photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export async function scanPhoto(file: Blob): Promise<ScanOutcome> {
  let body: Blob;
  try {
    body = await prepareImage(file);
  } catch {
    return { ok: false, message: "Couldn't read that photo. Try taking it again." };
  }

  let response: Response;
  try {
    response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': body.type },
      body,
    });
  } catch {
    return { ok: false, message: 'No connection. Check your signal and try again.' };
  }

  const payload = (await response.json().catch(() => null)) as
    | (ScanResponse & { error?: string })
    | null;

  if (!response.ok) {
    return { ok: false, message: payload?.error ?? 'That scan failed. Try again.' };
  }
  if (!payload) {
    return { ok: false, message: "Couldn't understand the reading. Try again." };
  }

  // The browser re-runs the same validation the Worker did, so it never has to
  // take the response on trust.
  return toOutcome(payload);
}

/** Re-validate after the player edits a letter — sorting, and so tile IDs, may shift. */
export function toOutcome(response: ScanResponse): ScanOutcome {
  const result = validateScan(response);
  return result.ok ? { ok: true, value: result.value } : { ok: false, message: result.error.message };
}
