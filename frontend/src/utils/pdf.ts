
import { getDocument } from "pdfjs-dist";
import { prepareCanvas, type PreparedPage } from "./pages";

export interface PdfPage extends PreparedPage {
  text: string;
}

const MAX_SIDE = 1800;

export async function importPdf(
  file: File,
  enhance: boolean,
  maxPages: number,
  onProgress: (current: number, total: number) => void
): Promise<{ pages: PdfPage[]; totalPages: number }> {
  const data = await file.arrayBuffer();

  const pdf = await getDocument({ data }).promise;
  const pages: PdfPage[] = [];
  const totalPages = pdf.numPages;
  const pagesToImport = Math.min(totalPages, maxPages);

  try {
    for (let count = 1; count <= pagesToImport; count++) {
      const page = await pdf.getPage(count);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, MAX_SIDE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item
            ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
            : ""
        )
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();

      const prepared = await prepareCanvas(canvas, enhance);
      pages.push({ ...prepared, text });

      page.cleanup();
      onProgress(count, pagesToImport);
    }
  } finally {
    await pdf.cleanup();
  }

  return { pages, totalPages };
}