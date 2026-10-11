import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { prepareCanvas, type PreparedPage } from "./pages";

export interface PdfPage extends PreparedPage {
  text: string; // text found inside the PDF itself (empty for scanned PDFs)
}

const MAX_SIDE = 1800;

// Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image, and reads its text when // Turns each page of a PDF into an image,ge.getViewport({ scale: 1 });
      const scale = Math.min(3, MAX_SIDE / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const params = { canvasContext: ctx, canvas, viewport };
      await page.render(params as Parameters<typeof page.render>[0]).promise;

      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();

      const prepared = await prepareCanvas(canvas, enhance);
      pages.push({ ...prepared, text });
      page.cleanup();
    }
    onProgress(count, count);
  } finally {
    await pdf.destroy();
  }

  return { pages, totalPages: pdf.numPages };
}
