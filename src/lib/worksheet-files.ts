import { MAX_WORKSHEET_PAGES } from "@/lib/worksheet-contract";

export type WorksheetPage = { page: number; name: string; text: string; image?: string };
export async function readWorksheetFiles(files: File[], onProgress?: (page: number, name: string) => void): Promise<WorksheetPage[]> {
  if (!files.length || files.length > MAX_WORKSHEET_PAGES) throw new Error("Chọn từ 1 đến 6 file.");
  if (files.some((file) => file.size > 20 * 1024 * 1024)) throw new Error("Mỗi file tối đa 20 MB.");
  const pages: WorksheetPage[] = [];
  const add = (page: Omit<WorksheetPage, "page">) => {
    if (pages.length >= MAX_WORKSHEET_PAGES) throw new Error("Một lượt tối đa 6 trang. Chia tài liệu thành các file nhỏ hơn.");
    pages.push({ ...page, page: pages.length + 1 });
    onProgress?.(pages.length, page.name);
  };
  for (const file of files) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      let timedOut = false;
      const deadline = setTimeout(() => { timedOut = true; void task.destroy().catch(() => undefined); }, 45_000);
      try {
        const pdf = await task.promise;
        if (pdf.numPages + pages.length > MAX_WORKSHEET_PAGES) throw new Error("Một lượt tối đa 6 trang PDF/ảnh. Vui lòng tách file.");
        for (let index = 1; index <= pdf.numPages; index++) {
          const page = await pdf.getPage(index);
          const viewport = page.getViewport({ scale: 1 });
          const scaled = page.getViewport({ scale: Math.min(2.2, 1600 / Math.max(viewport.width, viewport.height)) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(scaled.width); canvas.height = Math.ceil(scaled.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Không đọc được trang PDF.");
          await page.render({ canvas, canvasContext: context, viewport: scaled }).promise;
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").slice(0, 20_000);
          add({ name: `${file.name} · ${index}`, text, image: canvas.toDataURL("image/jpeg", .86) });
          canvas.width = canvas.height = 0;
        }
      } catch (reason) {
        if (timedOut) throw new Error("Đọc PDF quá 45 giây. Thử tách file hoặc xuất lại PDF; đề chưa được gửi tới ChatGPT.");
        throw reason;
      } finally { clearTimeout(deadline); await task.destroy().catch(() => undefined); }
    } else if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      const image = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Không đọc được ảnh.");
        context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        add({ name: file.name, text: "", image: canvas.toDataURL("image/jpeg", .86) });
      } finally { image.close(); }
    } else if (file.type === "text/plain" || /\.txt$/i.test(file.name)) {
      if (file.size > 80_000) throw new Error("File văn bản tối đa 80 KB.");
      const text = await file.text();
      if (text.length > 20_000) throw new Error("File văn bản tối đa 20.000 ký tự.");
      add({ name: file.name, text });
    } else throw new Error("Chỉ nhận PDF, JPG, PNG, WebP hoặc TXT.");
  }
  return pages;
}
