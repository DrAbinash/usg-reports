/**
 * imageCrop.ts — auto-crop black borders from ultrasound images.
 *
 * DICOM images rendered from Orthanc often have black padding around the
 * actual ultrasound content. This module detects the bounding box of
 * non-black content and crops it out — producing a cleaner print.
 *
 * Works on canvas-rendered images (client-side). If auto-crop fails (e.g.
 * the image is entirely black or the content detection is uncertain),
 * the caller can fall back to manual crop mode.
 *
 * Algorithm: scan pixel rows/columns for the first/last non-black row/column.
 * A pixel is "black" when all RGB channels are below a threshold (default 15).
 */

export type CropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropResult = {
  cropped: boolean;
  box: CropBox | null;
  /** Original image dimensions. */
  originalWidth: number;
  originalHeight: number;
  /** Reason if cropping was skipped. */
  reason?: string;
};

const DEFAULT_THRESHOLD = 15; // RGB 0-255; pixels below this are "black"
const DEFAULT_MARGIN = 4; // px of margin to keep around content
const MIN_CONTENT_RATIO = 0.1; // if content < 10% of image, probably wrong

/**
 * Auto-detect the bounding box of non-black content in an image.
 * Returns the crop box or null if no content is found.
 *
 * @param canvas — the source canvas (already drawn with the image)
 * @param threshold — RGB value below which a pixel is considered "black" (0-255)
 * @param margin — pixels of margin to keep around the content
 */
export function detectContentBounds(
  canvas: HTMLCanvasElement,
  threshold: number = DEFAULT_THRESHOLD,
  margin: number = DEFAULT_MARGIN,
): CropResult {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { cropped: false, box: null, originalWidth: canvas.width, originalHeight: canvas.height, reason: "No 2D context" };

  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return { cropped: false, box: null, originalWidth: w, originalHeight: h, reason: "Empty canvas" };

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let contentPixels = 0;

  // Scan every pixel — find the bounding box of non-black content
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // A pixel is "content" if any channel exceeds the threshold
      if (r > threshold || g > threshold || b > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        contentPixels++;
      }
    }
  }

  if (contentPixels === 0) {
    return { cropped: false, box: null, originalWidth: w, originalHeight: h, reason: "Image is entirely black" };
  }

  const contentRatio = contentPixels / (w * h);
  if (contentRatio < MIN_CONTENT_RATIO) {
    return { cropped: false, box: null, originalWidth: w, originalHeight: h, reason: `Content too small (${(contentRatio * 100).toFixed(1)}%)` };
  }

  // Add margin (clamped to image bounds)
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(w - 1, maxX + margin);
  maxY = Math.min(h - 1, maxY + margin);

  const box: CropBox = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };

  // Check if cropping would actually remove anything
  const wouldCrop = box.x > 0 || box.y > 0 || box.width < w || box.height < h;

  return {
    cropped: wouldCrop,
    box,
    originalWidth: w,
    originalHeight: h,
  };
}

/**
 * Apply a crop box to a canvas and return a new cropped canvas.
 */
export function applyCrop(
  sourceCanvas: HTMLCanvasElement,
  box: CropBox,
): HTMLCanvasElement {
  const target = document.createElement("canvas");
  target.width = box.width;
  target.height = box.height;
  const ctx = target.getContext("2d");
  if (!ctx) return sourceCanvas;

  ctx.drawImage(
    sourceCanvas,
    box.x, box.y, box.width, box.height,
    0, 0, box.width, box.height,
  );

  return target;
}

/**
 * Auto-crop a canvas image: detect content bounds and crop.
 * Returns the cropped canvas (or the original if no crop needed).
 */
export function autoCropCanvas(
  canvas: HTMLCanvasElement,
  threshold?: number,
): { canvas: HTMLCanvasElement; result: CropResult } {
  const result = detectContentBounds(canvas, threshold);
  if (result.cropped && result.box) {
    return { canvas: applyCrop(canvas, result.box), result };
  }
  return { canvas, result };
}

/**
 * Auto-crop an image element: load it into a canvas, crop, return data URL.
 */
export async function autoCropImage(
  imgSrc: string,
  threshold?: number,
): Promise<{ dataUrl: string; result: CropResult }> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imgSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D context");

  ctx.drawImage(img, 0, 0);

  const { canvas: cropped, result } = autoCropCanvas(canvas, threshold);

  return {
    dataUrl: cropped.toDataURL("image/jpeg", 0.92),
    result,
  };
}

/**
 * Manual crop: given a user-defined crop box (from a drag selection),
 * apply it to an image and return the cropped data URL.
 */
export async function manualCropImage(
  imgSrc: string,
  box: CropBox,
): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imgSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  ctx.drawImage(img, 0, 0);

  const cropped = applyCrop(canvas, box);
  return cropped.toDataURL("image/jpeg", 0.92);
}

/**
 * Resize an image data URL to a target max dimension while preserving aspect ratio.
 * Used for "enlarge / reduce" image size controls.
 */
export async function resizeImage(
  imgSrc: string,
  maxDimension: number,
): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imgSrc;
  });

  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  const scale = Math.min(maxDimension / origW, maxDimension / origH, 1.5); // cap at 1.5× enlarge

  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imgSrc;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Preset image sizes (max dimension in pixels). */
export const IMAGE_SIZE_PRESETS = [
  { label: "Small", value: 300 },
  { label: "Medium", value: 500 },
  { label: "Large", value: 800 },
  { label: "Original", value: 0 }, // 0 = no resize
] as const;
