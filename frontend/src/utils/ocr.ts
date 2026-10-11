export const OCR_LANGUAGES = [
{ code: "eng", label: "English" },
{ code: "hin", label: "Hindi" },
{ code: "spa", label: "Spanish" },
{ code: "fra", label: "French" },
{ code: "deu", label: "German" },
];

// Reads text from images in the browser.
export async function recognizeText(
image: Blob,
lang: string,
onProgress: (fraction: number) => void
): Promise<string> {
const { createWorker } = await import("tesseract.js");
const worker = await createWorker(lang, 1, {
logger: (message) => {
if (message.status === "recognizing text") {
onProgress(message.progress);
}
},
});

try {
const { data } = await worker.recognize(image);
return data.text;
} finally {
await worker.terminate();
}
}

// Reads multiple pages and supports stopping between pages.
export async function recognizePages(
images: (Blob | null)[],
lang: string,
onProgress: (pageIndex: number, fraction: number) => void,
shouldStop: () => boolean
): Promise<(string | null)[]> {
const results: (string | null)[] = [];

for (let i = 0; i < images.length; i++) {
if (shouldStop()) break;


const image = images[i];

if (!image) {
  results.push(null);
  continue;
}

const text = await recognizeText(image, lang, (fraction) => {
  onProgress(i, fraction);
});

results.push(text);

if (shouldStop()) break;


}

return results;
}
