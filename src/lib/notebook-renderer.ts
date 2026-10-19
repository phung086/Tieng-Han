import { LEFT, PAGE_HEIGHT, PAGE_WIDTH, RULE_GAP, TOP, layoutNotebook, seededRandom, type NotebookLine, type NotebookStyle } from "@/lib/worksheet-layout";
import type { WorksheetItem } from "@/lib/worksheet-contract";

const latin = "HaneulNotebookLatin";
const korean = "HaneulNotebookKorean";
const hangul = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u;

function runs(text: string) {
  // Keep Vietnamese ligatures/diacritics intact; choose a Hangul face per run.
  return text.normalize("NFC").match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+|[^\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+/gu) ?? [];
}
function setFont(ctx: CanvasRenderingContext2D, text: string, size: number) {
  ctx.font = `400 ${size * (hangul.test(text) ? 1.2 : 1.05)}px ${hangul.test(text) ? korean : latin}`;
}
function measure(ctx: CanvasRenderingContext2D, text: string, size: number) {
  return runs(text).reduce((width, run) => { setFont(ctx, run, size); return width + ctx.measureText(run).width; }, 0);
}

export async function prepareNotebook(items: WorksheetItem[], style: NotebookStyle) {
  if (!items.length) return [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`400 44px ${latin}`, "Tiếng Việt người giáo viên"), document.fonts.load(`400 52px ${korean}`, "한국어 선생님입니다")]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Phông chữ chưa tải sau 15 giây. Kiểm tra mạng hoặc tải lại trang; nội dung bài vẫn được giữ.")), 15_000); }),
    ]);
  } finally { clearTimeout(timer); }
  if (!document.fonts.check(`44px ${latin}`) || !document.fonts.check(`52px ${korean}`)) throw new Error("Chưa tải được phông chữ viết tay. Tải lại trang rồi thử xuất vở.");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ vẽ trang vở.");
  return layoutNotebook(items, (text) => measure(ctx, text, style.size));
}

export function renderNotebookPage(lines: NotebookLine[], style: NotebookStyle, page: number) {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Không tạo được trang vở.");
  const random = seededRandom(style.seed + page * 104729);
  ctx.fillStyle = "#f8f6ee";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  if (style.texture) {
    const paper = ctx.createLinearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    paper.addColorStop(0, "rgba(72,66,51,.10)");
    paper.addColorStop(.3, "rgba(255,255,255,.18)");
    paper.addColorStop(1, "rgba(68,65,52,.09)");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    const pixels = ctx.getImageData(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      const noise = Math.round((random() - .5) * 7);
      pixels.data[offset] += noise; pixels.data[offset + 1] += noise; pixels.data[offset + 2] += noise;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = "rgba(104,110,116,.40)";
  ctx.setLineDash([5, 4]);
  for (let y = TOP + 9; y < PAGE_HEIGHT - 90; y += RULE_GAP) {
    ctx.beginPath(); ctx.moveTo(98, y); ctx.lineTo(PAGE_WIDTH - 85, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // A thin binding margin, intentionally without logos, titles or extra page text.
  ctx.strokeStyle = "rgba(154,121,122,.27)";
  ctx.beginPath(); ctx.moveTo(110, 80); ctx.lineTo(110, PAGE_HEIGHT - 80); ctx.stroke();
  const pen = style.ink === "blue" ? "#292c69" : "#303336";
  lines.forEach((line) => {
    let x = LEFT + (line.role === "answer" ? 32 : 0) + (random() - .5) * 5;
    const y = TOP + line.row * RULE_GAP;
    const words = line.text.split(/(\s+)/);
    for (const word of words) {
      const width = measure(ctx, word, style.size);
      if (!word.trim()) { x += width; continue; }
      ctx.save();
      const loose = !hangul.test(word);
      ctx.translate(x, y + (random() - .5) * (loose ? 10 : 3.2));
      ctx.rotate((random() - .5) * (loose ? .075 : .018));
      ctx.fillStyle = pen;
      ctx.strokeStyle = pen;
      ctx.globalAlpha = .76 + random() * .18;
      let runX = 0;
      for (const run of runs(word)) {
        setFont(ctx, run, style.size);
        const runWidth = ctx.measureText(run).width;
        if (hangul.test(run)) {
          ctx.fillText(run, runX, 0);
          ctx.lineWidth = .10 + random() * .18;
          ctx.strokeText(run, runX, 0);
        } else {
          // Thin monoline cursive, like the references: tall loops, inconsistent
          // letter height/slant and wandering baselines. NFC keeps each accent
          // attached to its letter. Advance positions stay bounded by the layout.
          const letters = Array.from(run.normalize("NFC"));
          let advance = runX;
          let prefix = "";
          for (let index = 0; index < letters.length; index++) {
            const char = letters[index];
            const width = ctx.measureText(prefix + char).width - ctx.measureText(prefix).width;
            ctx.save();
            ctx.translate(advance, Math.sin(index * 1.1) * 2.2 + (random() - .5) * 5.2);
            ctx.transform(.78 + random() * .32, 0, (random() - .5) * .27, .76 + random() * .38, 0, 0);
            ctx.rotate((random() - .5) * .16);
            ctx.globalAlpha *= .88 + random() * .12;
            ctx.fillText(char, 0, 0);
            ctx.restore();
            advance += width;
            prefix += char;
          }
        }
        runX += runWidth;
      }
      ctx.restore();
      x += width;
    }
  });
  return canvas;
}

export async function notebookPdf(pages: NotebookLine[][], style: NotebookStyle) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Vở bài tập");
  pdf.setSubject("Digitally rendered notebook in a handwriting / scan style");
  pdf.setCreator("Haneul notebook renderer");
  for (let index = 0; index < pages.length; index++) {
    const canvas = renderNotebookPage(pages[index], style, index);
    const image = await pdf.embedJpg(canvas.toDataURL("image/jpeg", .94));
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    canvas.width = canvas.height = 0;
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
}

export function downloadWorksheet(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
