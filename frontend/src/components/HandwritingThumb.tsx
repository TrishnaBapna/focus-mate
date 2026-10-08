import { useEffect, useRef } from "react";
import { PAGE_H, PAGE_W, drawAll, parseStrokes } from "../utils/drawing";

// Small preview of a handwritten note, shown in the notes list
export default function HandwritingThumb({ strokesJson }: { strokesJson?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 400;
    const h = Math.round((w * PAGE_H) / PAGE_W);
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(w / PAGE_W, 0, 0, h / PAGE_H, 0, 0);
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    drawAll(ctx, parseStrokes(strokesJson));
  }, [strokesJson]);

  return <canvas ref={ref} className="note-thumb" />;
}
