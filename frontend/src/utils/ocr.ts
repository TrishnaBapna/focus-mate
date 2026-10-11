export const OCR_LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "hin", label: "Hindi" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
];

// Reads the text in an image, right in the browser.
// The library is loaded only when needed, so the rest of the app stays light.
export async function recognizeText(
  image: Blob,
  lang: string,
  onProgress: (fraction: number) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    },
  });

  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// Reads many pages with the same engine (much faster than starting // Reads many pages with the same engine (much faster than starting // Reads many pages with the same engc function recognizePages(
  images: (Blob | null)[],
  lang: string,
  onProgress: (pageIndex: number, fraction: number) => void,
  shouldStop: () => boolean
): Promise<(string | null)[]> {
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress(current, m.progress);
    },
  });

  try {
    const results: (string | null)[] = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (shouldStop() || !image) {
        results.push(null);
        continue;
      }
      current = i;
      onProgress(i, 0);
      const { data } = await worker.recognize(image);
      results.push(data.text);
    }
    return results;
  } finally {
    await worker.terminate();
  }
}
