// pdfjs-dist wrapper — sets up worker once and exposes simple helpers.
import * as pdfjsLib from "pdfjs-dist";
// Use Vite ?url import to bundle the worker file properly.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdfDoc(file: File | Blob | ArrayBuffer) {
  const data =
    file instanceof ArrayBuffer ? file : await (file as Blob).arrayBuffer();
  return pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
}

export async function renderPageToCanvas(
  pdf: Awaited<ReturnType<typeof loadPdfDoc>>,
  pageNum: number,
  scale = 2
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg" = "image/png",
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      type,
      quality
    )
  );
}
