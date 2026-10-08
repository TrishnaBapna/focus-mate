const MAX_SIDE = 1800; // longest side of the saved photo, in pixels
const TARGET_BYTES = 800000; // keep well under the ~1 MB storage limit
const THUMB_WIDTH = 320;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad-image"));
    };
    img.src = url;
  });
}

function render(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))),
      "image/jpeg",
      quality
    );
  });
}

export interface PreparedImage {
  blob: Blob;
  thumb: string; // small data URL for the notes list
}

// Shrinks a photo until it is small enough to store, and makes a thumbnail.
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  let scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  let quality = 0.8;
  let blob = await encode(render(img, Math.round(w * scale), Math.round(h * scale)), quality);

  for (let i = 0; i < 6 && blob.size > TARGET_BYTES; i++) {
    quality = Math.max(0.5, quality - 0.08);
    scale *= 0.85;
    blob = await encode(render(img, Math.round(w * scale), Math.round(h * scale)), quality);
  }

  const thumbScale = Math.min(1, THUMB_WIDTH / w);
  const thumb = render(img, Math.round(w * thumbScale), Math.round(h * thumbScale)).toDataURL(
    "image/jpeg",
    0.6
  );

  return { blob, thumb };
}
