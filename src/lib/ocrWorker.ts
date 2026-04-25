// Lazy Tesseract.js worker. Created once per language on first use.
import { createWorker, type Worker } from "tesseract.js";

let cachedLang: string | null = null;
let cachedWorker: Worker | null = null;

export async function getOcrWorker(
  lang = "eng",
  onProgress?: (p: number) => void
): Promise<Worker> {
  if (cachedWorker && cachedLang === lang) return cachedWorker;
  if (cachedWorker) {
    await cachedWorker.terminate();
    cachedWorker = null;
  }
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  cachedWorker = worker;
  cachedLang = lang;
  return worker;
}

export async function terminateOcrWorker() {
  if (cachedWorker) {
    await cachedWorker.terminate();
    cachedWorker = null;
    cachedLang = null;
  }
}
