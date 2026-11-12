// Serve the OCR engine and models from the same origin as the wallet.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
const resolve = createRequire(import.meta.url).resolve;
const root = (pkg) => dirname(resolve(pkg + "/package.json"));
const target = join(process.cwd(), "public", "ocr-v7");
await mkdir(target, { recursive: true });
const files = [
  [root("tesseract.js"), "dist/tesseract.esm.min.js", "tesseract.esm.min.js"],
  [root("tesseract.js"), "dist/worker.min.js", "worker.min.js"],
  [
    root("tesseract.js"),
    "dist/worker.min.js.LICENSE.txt",
    "worker.min.js.LICENSE.txt",
  ],
  [
    root("tesseract.js"),
    "dist/tesseract.min.js.LICENSE.txt",
    "tesseract.min.js.LICENSE.txt",
  ],
  [root("tesseract.js"), "LICENSE.md", "Tesseract-LICENSE.txt"],
  [root("tesseract.js-core"), "LICENSE", "Core-LICENSE.txt"],
];
for (const variant of ["", "-simd", "-relaxedsimd"]) {
  const file = "tesseract-core" + variant + "-lstm.wasm.js";
  files.push([root("tesseract.js-core"), file, file]);
}
for (const lang of ["chi_sim", "eng"]) {
  const file = lang + ".traineddata.gz";
  files.push([
    root("@tesseract.js-data/" + lang),
    "4.0.0_best_int/" + file,
    file,
  ]);
}
await Promise.all(
  files.map(([dir, src, dest]) => copyFile(join(dir, src), join(target, dest))),
);
