export type ReceiptScanResult = {
  merchant: string;
  date: string;
  total: number;
  tax: number;
  category: string;
  memo: string;
  confidence: number;
  rawText: string;
};

type ProgressUpdate = { status: string; progress: number };
type OcrWorker = {
  setParameters(parameters: Record<string, string | number>): Promise<unknown>;
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string; confidence: number } }>;
  terminate(): Promise<unknown>;
};
type OcrBrowserModule = {
  createWorker(language: string, engineMode: number, options: { workerPath: string; corePath: string; langPath: string; logger: (message: ProgressUpdate) => void }): Promise<OcrWorker>;
};


const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: "Food", pattern: /\b(restaurant|cafe|coffee|bakery|pizza|grill|kitchen|diner|taco|sushi|market|grocery|grocer|foods|aldi|kroger|safeway|publix|starbucks|doordash|uber eats)\b/i },
  { category: "Transportation", pattern: /\b(gas|fuel|shell|chevron|exxon|mobil|bp|arco|parking|toll|uber|lyft|transit|metro|auto parts|car wash)\b/i },
  { category: "Utilities", pattern: /\b(electric|energy|water|sewer|internet|wireless|phone|comcast|xfinity|spectrum|verizon|at&t|utility)\b/i },
  { category: "Health", pattern: /\b(pharmacy|cvs|walgreens|rite aid|clinic|hospital|medical|dental|vision|health)\b/i },
  { category: "Housing", pattern: /\b(home depot|lowe'?s|hardware|ikea|furniture|rent|property|garden center)\b/i },
  { category: "Shopping", pattern: /\b(target|walmart|costco|amazon|department|outlet|store|mart|shop|office depot|staples|best buy)\b/i },
];

function normalizeDate(text: string) {
  const numeric = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (numeric) {
    const year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const named = text.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,)?\s+\d{2,4}\b/i);
  if (named) {
    const parsed = new Date(named[0]);
    if (!Number.isNaN(parsed.valueOf())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function amountsIn(line: string) {
  return [...line.matchAll(/(?:[$£€]\s*)?(\d{1,3}(?:,\d{3})*|\d+)[.,](\d{2})\b/g)]
    .map((match) => Number(`${match[1].replace(/,/g, "")}.${match[2]}`))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1_000_000);
}

function extractTotal(lines: string[]) {
  const candidates: { value: number; score: number }[] = [];
  lines.forEach((line, index) => {
    if (/\b(sub\s*total|subtotal|tax|change|savings|discount|tip)\b/i.test(line)) return;
    const values = amountsIn(line);
    if (!values.length) return;
    let score = 0;
    if (/\b(grand\s+total|amount\s+due|total\s+due)\b/i.test(line)) score = 120;
    else if (/\b(balance\s+due|balance)\b/i.test(line)) score = 105;
    else if (/\btotal\b/i.test(line)) score = 95;
    else if (index >= lines.length * 0.55) score = 25;
    if (score) candidates.push({ value: values.at(-1) ?? 0, score: score + index / Math.max(1, lines.length) });
  });
  return candidates.sort((a, b) => b.score - a.score || b.value - a.value)[0]?.value ?? 0;
}

function extractTax(lines: string[]) {
  const candidates = lines.filter((line) => /\b(tax|sales\s+tax|vat)\b/i.test(line) && !/tax\s*(id|#)/i.test(line)).flatMap(amountsIn);
  return candidates.at(-1) ?? 0;
}

function merchantFrom(lines: string[]) {
  const noise = /\b(receipt|invoice|order|transaction|date|time|cashier|register|subtotal|total|tax|change|visa|mastercard|amex|approved|thank|welcome|customer|copy)\b/i;
  const candidate = lines.slice(0, 12).find((line) => {
    const letters = line.match(/[a-z]/gi)?.length ?? 0;
    return letters >= 3 && line.length <= 48 && !noise.test(line) && !/\b(www\.|\.com|tel|phone)\b/i.test(line) && !/^\s*\d+[\s-]/.test(line) && !amountsIn(line).length;
  });
  return (candidate ?? lines.find((line) => (line.match(/[a-z]/gi)?.length ?? 0) >= 3) ?? "Unknown merchant")
    .replace(/[^a-z0-9&'\-. ]/gi, " ").replace(/\s+/g, " ").trim();
}

function inferCategory(text: string) {
  return CATEGORY_RULES.find((rule) => rule.pattern.test(text))?.category ?? "Other";
}

async function loadImage(file: File) {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The receipt photo could not be opened."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareImage(file: File) {
  const image = await loadImage(file);
  const sourceWidth = "naturalWidth" in image ? image.naturalWidth : image.width;
  const sourceHeight = "naturalHeight" in image ? image.naturalHeight : image.height;
  const upscale = sourceWidth < 1400 ? Math.min(2, 1400 / Math.max(1, sourceWidth)) : 1;
  const downscale = Math.min(1, 2400 / Math.max(sourceWidth, sourceHeight));
  const scale = Math.min(upscale, downscale);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot prepare receipt images.");
  context.fillStyle = "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  if ("close" in image && typeof image.close === "function") image.close();
  const pixels = context.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.22 + 128));
    pixels.data[index] = contrasted;
    pixels.data[index + 1] = contrasted;
    pixels.data[index + 2] = contrasted;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export async function scanReceipt(file: File, onProgress: (update: ProgressUpdate) => void): Promise<ReceiptScanResult> {
  const canvas = await prepareImage(file);
  const browserModulePath = "/ocr/tesseract.esm.min.js";
  const { createWorker } = await import(/* @vite-ignore */ browserModulePath) as OcrBrowserModule;
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    logger: (message) => onProgress({ status: message.status, progress: Number(message.progress ?? 0) }),
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: 3, preserve_interword_spaces: "1" });
    const result = await worker.recognize(canvas);
    const rawText = result.data.text.trim();
    if (!rawText) throw new Error("No readable text was found. Try a sharper photo with the receipt filling the frame.");
    const lines = rawText.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const merchant = merchantFrom(lines);
    const tax = extractTax(lines);
    const total = extractTotal(lines);
    const category = inferCategory(`${merchant}\n${rawText}`);
    return {
      merchant,
      date: normalizeDate(rawText),
      total,
      tax,
      category,
      memo: tax > 0 ? `Receipt scan - tax $${tax.toFixed(2)}` : "Receipt scan",
      confidence: Math.round(result.data.confidence),
      rawText,
    };
  } finally {
    await worker.terminate();
  }
}
