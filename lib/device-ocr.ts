import type { Worker } from "tesseract.js";

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
          progress("正在载入中英文识别…");
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
      const { data } = await reader.recognize(image);
      readings.push({ text: data.text, confidence: data.confidence });
    }
    return readings;
  };
  timer = setTimeout(
    () => stop(new Error("识别组件加载超时，请检查网络后重试。")),
    120000,
  );
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  progress("正在准备本机识别…");
  try {
    return await Promise.race([run(), interrupted]);
  } finally {
    ended = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    await reader?.terminate();
  }
}
