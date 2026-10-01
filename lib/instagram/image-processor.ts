import sharp from 'sharp';

const MAX_WIDTH = 1440;
const JPEG_QUALITY = 85;

export async function processImageForInstagram(
  buffer: Buffer,
  targetAspectRatio?: string,
): Promise<Buffer> {
  let pipeline = sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true });

  // Get metadata for aspect ratio enforcement
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? MAX_WIDTH;
  const height = metadata.height ?? MAX_WIDTH;

  // Resize to max width
  if (width > MAX_WIDTH) {
    pipeline = pipeline.resize(MAX_WIDTH, undefined, { withoutEnlargement: true });
  }

  // Apply aspect ratio crop if specified
  if (targetAspectRatio) {
    const [w, h] = targetAspectRatio.split(':').map(Number);
    const targetRatio = w / h;
    const currentRatio = width / height;

    if (Math.abs(currentRatio - targetRatio) > 0.01) {
      const finalWidth = Math.min(width, MAX_WIDTH);
      const finalHeight = Math.round(finalWidth / targetRatio);
      pipeline = pipeline.resize(finalWidth, finalHeight, { fit: 'cover' });
    }
  }

  return pipeline.toBuffer();
}

export function validateAspectRatio(width: number, height: number): { valid: boolean; ratio: number; suggestion?: string } {
  const ratio = width / height;
  // Instagram allows 4:5 (0.8) to 1.91:1 (1.91)
  if (ratio < 0.8 || ratio > 1.91) {
    return {
      valid: false,
      ratio,
      suggestion: ratio < 0.8 ? 'La imagen es demasiado alta. Usa formato 4:5 o 1:1.' : 'La imagen es demasiado ancha. Usa formato 1.91:1 o 1:1.',
    };
  }
  return { valid: true, ratio };
}
