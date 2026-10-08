import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PAGE_H, PAGE_W, drawAll, drawSegment, type Stroke } from "../utils/drawing";

export type Tool = "pen" | "eraser" | "hand";

interface Props {
  strokes: Stroke[];
  tool: Tool;
  color: string;
  width: number;
  onCommit: (stroke: Stroke) => void;
}

function pagePoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.round(((clientX - rect.left) / rect.width) * PAGE_W),
    Math.round(((clientY - rect.top) / rect.height) * PAGE_H),
  ];
}

export default function DrawingCanvas({ strokes, tool, color, width, onCommit }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const penSeen = useRef(false);
  const [cssWidth, setCssWidth] = useState(0);

  // Keep track of how wide the page is on screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setCssWidth(el.clientWidth));
    observer.observe(el);
    setCssWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Repaint everything whenever the strokes or the size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = cssWidth / PAGE_W;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(PAGE_W * scale * dpr);
    const h = Math.round(PAGE_H * scale * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    drawAll(ctx, strokes);
  }, [strokes, cssWidth]);

  function handleDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === "hand") return;
    if (e.pointerType === "pen") penSeen.current = true;
    if (e.pointerType === "touch" && penSeen.current) return; // palm rejection
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const canvas = e.currentTarget;
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = pagePoint(canvas, e.clientX, e.clientY);

    const stroke: Stroke =
      tool === "eraser"
        ? { c: "#000000", w: Math.max(16, width * 4), e: true, p: [x, y] }
        : { c: color, w: width, p: [x, y] };
    current.current = stroke;

    const ctx = canvas.getContext("2d");
    if (ctx) drawSegment(ctx, stroke, x, y, x, y);
  }

  function handleMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const stroke = current.current;
    if (!stroke) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const native = e.nativeEvent;
    const coalesced = native.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [native];

    for (const ev of events) {
      const [x, y] = pagePoint(canvas, ev.clientX, ev.clientY);
      const n = stroke.p.length;
      const lastX = stroke.p[n - 2];
      const lastY = stroke.p[n - 1];
      if (Math.abs(x - lastX) + Math.abs(y - lastY) < 2) continue;
      drawSegment(ctx, stroke, lastX, lastY, x, y);
      stroke.p.push(x, y);
    }
  }

  function finish() {
    const stroke = current.current;
    current.current = null;
    if (stroke) onCommit(stroke);
  }

  return (
    <div ref={wrapRef} className="drawing-wrap">
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        style={{
          width: "100%",
          aspectRatio: `${PAGE_W} / ${PAGE_H}`,
          touchAction: tool === "hand" ? "auto" : "none",
          cursor: tool === "hand" ? "grab" : "crosshair",
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
    </div>
  );
}
