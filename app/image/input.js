import { pngDimensions } from '../../lib/image/screenshot.js';
import { imageView } from './view.js';
import { ImageDialog } from './dialog.js';

/** Resolves on dialog close, not initial analysis; callers can prevent overlapping dialogs. */
export async function imageInput(file, worker, context) {
  if (!file || file.size > 16 * 1024 * 1024) throw new Error('Use a PNG no larger than 16 MB.');
  if (!crypto.subtle) throw new Error('Screenshot hashing requires HTTPS or a secure localhost origin.');
  const bytes = new Uint8Array(await file.arrayBuffer()), dimensions = pngDimensions(bytes);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const captureSha256 = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) {
    bitmap.close(); throw new Error('Decoded image dimensions disagree with the PNG header.');
  }
  try {
    const view = imageView(context.kind, dimensions, context.native, context.options);
    await new ImageDialog(view, bitmap, worker, { ...context, dimensions, captureSha256, fileName: file.name }).open();
  } finally { bitmap.close(); }
}
