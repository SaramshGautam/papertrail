// import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// GlobalWorkerOptions.workerSrc = new URL(
//   "pdf.worker.min.mjs",
//   import.meta.url
// ).toString();

import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfMetadata(file) {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // 1) Try embedded metadata
  const { info, metadata } = await pdf
    .getMetadata()
    .catch(() => ({ info: {}, metadata: null }));

  const title =
    info?.Title ||
    metadata?.get("dc:title") ||
    file.name.replace(/\.pdf$/i, "");

  const author = info?.Author || metadata?.get("dc:creator") || "";

  // You can also grab subject, keywords, etc:
  const subject = info?.Subject || metadata?.get("dc:description") || "";

  return {
    title: title?.toString().trim(),
    author: author?.toString().trim(),
    subject: subject?.toString().trim(),
  };
}

// export async function extractPdfTitleAuthorsHeuristic(file) {
//   const arrayBuffer = await file.arrayBuffer();
//   const loadingTask = getDocument({ data: arrayBuffer });
//   const pdf = await loadingTask.promise;
//   const page1 = await pdf.getPage(1);

//   const textContent = await page1.getTextContent();
//   const items = textContent.items || [];

//   // simplest: concatenate
//   const lines = [];
//   let currentLine = "";
//   let lastY = null;

//   for (const item of items) {
//     const str = item.str.trim();
//     if (!str) continue;

//     const y = item.transform[5]; // y position
//     if (lastY === null) {
//       lastY = y;
//     }

//     if (Math.abs(y - lastY) < 5) {
//       currentLine += (currentLine ? " " : "") + str;
//     } else {
//       lines.push(currentLine);
//       currentLine = str;
//       lastY = y;
//     }
//   }
//   if (currentLine) lines.push(currentLine);

//   const title = lines[0] || file.name.replace(/\.pdf$/i, "");
//   const authors = lines[1] || "";

//   return { title, authors };
// }

export async function extractPdfTitleAuthorsHeuristic(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page1 = await pdf.getPage(1);
  const textContent = await page1.getTextContent();

  const items = textContent.items || [];
  const lines = [];
  let currentLine = "";
  let lastY = null;

  for (const item of items) {
    const str = item.str.trim();
    if (!str) continue;

    const y = item.transform[5]; // y position
    if (lastY === null) {
      lastY = y;
    }

    if (Math.abs(y - lastY) < 5) {
      currentLine += (currentLine ? " " : "") + str;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = str;
      lastY = y;
    }
  }
  if (currentLine) lines.push(currentLine);

  const nonEmpty = lines.filter((l) => l && l.trim().length);
  const title = nonEmpty[0] || file.name.replace(/\.pdf$/i, "");
  const authors = nonEmpty[1] || "";

  return { title, authors };
}
