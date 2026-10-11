// Turns a photo (or a rendered PDF page) into a small, clean page image.
const MAX_SIDE = 1800; // longest side, in pixels
const TARGET_BYTES = 300000; // keep each page small enough for free storage
const THUMB_WIDTH = 160;

export interface PreparedPage {
  blob: Blob;
  thumb: string; // tiny preview (data URL)
}

type Source = HTMLImageElement | HTMLCanvasElement;

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

function sizeOf(source: Source) {
  return source instanceof HTMLImageElement
    ? { w: source.naturalWidth, h: source.naturalHeight }
    : { w: source.width, h: source.height };
}

// Grayscale plus contrast stretch: paper becomes white, ink stays dark
function enhanceContrast(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const histogram = new Uint32Array(256);

  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = gray;
    histogram[gray]++;
  }

  const total = w * h;
  const percentile = (p: number) => {
    let sum = 0;
    for (let v = 0; v < 256; v++) {
      sum += histogram[v];
      if (sum >= total * p) return v;
    }
    return 255;
  };
  const lo = percentile(0.02);
  const hi = Math.max(lo + 1, percentile(0.8));
  const range = hi - lo;

  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((d[i] - lo) * 255) / range)));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

function render(source: Source, scale: number, rotation: number, enhance: boolean) {
  const { w: sw, h: sh } = sizeOf(source);
  const turned = rotation % 180 !== 0;
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  const w = Math.max(1, turned ? dh : dw);
  const h = Math.max(1, turned ? dw : dh);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  if (enhance) enhanceContrast(ctx, w, h);
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

function thumbOf(canvas: HTMLCanvasElement) {
  const scale = Math.min(1, THUMB_WIDTH / canvas.width);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL("image/jpeg", 0.5);
}

async function finish(
  source: Source,
  rotation: number,
  enhance: boolean,
  startScale: number
): Promise<PreparedPage> {
  let scale = startScale;
  let quality = 0.78;
  let canvas = render(source, scale, rotation, enhance);
  let blob = await encode(canvas, quality);

  // Keep shrinking until the page is small enough
  for (let i = 0; i < 6 && blob.size > TARGET_BYTES; i++) {
    quality = Math.max(0.5, quality - 0.06);
    scale *= 0.88;
    canvas = render(source, scale, rotation, enhance);
    blob = await encode(canvas, quality);
  }

  return { blob, thumb: thumbOf(canvas) };
}

export async function preparePhoto(file: Blob, enhance: boolean): Promise<PreparedPage> {
  const img = await loadImage(file);
  const { w, h } = sizeOf(img);
  return finish(img, 0, enhance, Math.min(1, MAX_SIDE / Math.max(w, h)));
}

export function prepareCanvas(canvas: HTMLCanvasElement, enhance: boolean): Promise<PreparedPage> {
  const { w, h } = sizeOf(canvas);
  return finish(canvas, 0, enhance, Math.min(1, MAX_SIDE / Math.max(w, h)));
}

// Turns an already-prepared page a quarter turn clockwise
export async function rotatePage(blob: Blob): Promise<PreparedPage> {
  const img = await loadImage(blob);
  return finish(img, 90, false, 1);
}
