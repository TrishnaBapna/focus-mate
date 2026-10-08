// The page has a fixed "logical" size. Strokes are stored in these units,
// so a drawing looks the same on any screen size.
export const PAGE_W = 1000;
export const PAGE_H = 1250;

export interface Stroke {
  c: string; // colour
  w: number; // line width
  e?: boolean; // true = eraser stroke
  p: number[]; // flat list of points: [x1, y1, x2, y2, ...]
}

// One short line piece, used while the pen is moving
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  x0: number,
  y0: number,
  x1: number,
  y1: number
) {
  ctx.save();
  ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over";
  ctx.strokeStyle = s.c;
  ctx.lineWidth = s.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

// A whole stroke, smoothed with curves
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const p = s.p;
  if (p.length < 2) return;

  ctx.save();
  ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over";
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  ctx.lineWidth = s.w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawAll(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const s of strokes) drawStroke(ctx, s);
}

export function parseStrokes(json: string | undefined): Stroke[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? (value as Stroke[]) : [];
  } catch {
    return [];
  }
}

export function serializeStrokes(strokes: Stroke[]): string {
  return JSON.stringify(strokes);
}
