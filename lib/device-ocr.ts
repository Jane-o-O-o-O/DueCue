import type { Worker, Block, Line } from "tesseract.js";

// Sparse OCR often returns each column separately. Restore visual rows so the
// model sees a receipt label alongside its value, regardless of column order.
function readingOrder(blocks: Block[] | null, fallback: string) {
  const lines = blocks?.flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines))
    .filter(line => line.text.trim());
  if (!lines?.length) return fallback;
  const center = (line: Line) => (line.bbox.y0 + line.bbox.y1) / 2;
  const height = (line: Line) => line.bbox.y1 - line.bbox.y0;
  lines.sort((a, b) => center(a) - center(b));
  const rows: Line[][] = [];
  for (const line of lines) {
    const row = rows.at(-1);
    const first = row?.[0];
    if (row && first && Math.abs(center(line) - center(first)) <= Math.min(height(first), height(line)) * 0.55
      && row.every(other => line.bbox.x0 >= other.bbox.x1 || line.bbox.x1 <= other.bbox.x0)) row.push(line);
    else rows.push([line]);
  }
  return rows.map(row => row.sort((a, b) => a.bbox.x0 - b.bbox.x0)
    .map(line => line.text.trim()).join("    ")).join("\n");
}

export async function readScreenshots(
  images: string[],
  progress: (label: string) => void,
  signal: AbortSignal,
) {
  const root = new URL("/ocr-v7/", location.origin).href;
  let reader: Worker | undefined,
    ended = false;
  let timer: ReturnType<typeof setTimeout>;
  let stop!: (error: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    stop = reject;
  });
  const abort = () => stop(new Error("识别已取消。"));
  const run = async () => {
    const url = root + "tesseract.esm.min.js";
    const { default: sdk } = (await import(/* @vite-ignore */ url)) as {
      default: typeof import("tesseract.js");
    };
    if (ended) return [];
    let current = 1;
    reader = await sdk.createWorker(["chi_sim", "eng"], sdk.OEM.LSTM_ONLY, {
      workerPath: root + "worker.min.js",
      corePath: root.replace(/\/$/, ""),
      langPath: root,
      workerBlobURL: false,
      logger: (m) => {
        if (ended) return;
        if (m.status === "recognizing text")
          progress(
            `正在读取 ${current}/${images.length} · ${Math.round(m.progress * 100)}%`,
          );
        else if (m.status === "loading language traineddata")
          progress("正在准备解析…");
      },
      errorHandler: () => stop(new Error("本机识别未完成，请裁剪截图后重试。")),
    });
    if (ended) {
      await reader.terminate();
      return [];
    }
    await reader.setParameters({ tessedit_pageseg_mode: sdk.PSM.SPARSE_TEXT });
    const readings = [];
    for (const [i, image] of images.entries()) {
      if (ended) break;
      current = i + 1;
      clearTimeout(timer);
      timer = setTimeout(
        () => stop(new Error("读取时间过长，请裁剪到金额和日期区域后重试。")),
        120000,
      );
      const { data } = await reader.recognize(image, {}, { text: true, blocks: true });
      readings.push(readingOrder(data.blocks, data.text));
    }
    return readings;
  };
  timer = setTimeout(
    () => stop(new Error("加载时间较长，请检查网络后重试。")),
    120000,
  );
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  progress("正在准备解析…");
  try {
    return await Promise.race([run(), interrupted]);
  } finally {
    ended = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    await reader?.terminate();
  }
}
