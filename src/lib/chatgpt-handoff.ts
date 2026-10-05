import {
  COURSE_BUNDLE_FORMAT,
  COURSE_BUNDLE_VERSION,
} from "@/lib/course-bundle";

export const CHATGPT_HANDOFF_FORMAT = "haneul-chatgpt-handoff";
export const CHATGPT_HANDOFF_VERSION = 1;

export type SourceFingerprint = {
  name: string;
  size: number;
  lastModified: number;
  pageCount: number;
  sha256: string;
};

export type HandoffLessonStart = {
  lessonId: number;
  pageNumber: number;
  titleHint?: string;
};

export type ChatGptHandoffPackage = {
  format: typeof CHATGPT_HANDOFF_FORMAT;
  version: typeof CHATGPT_HANDOFF_VERSION;
  createdAt: string;
  sourceFiles: SourceFingerprint[];
  detectedMaps: Array<{
    fileName: string;
    starts: HandoffLessonStart[];
  }>;
  courseHint: {
    title: string;
    level: string;
    edition?: string;
  };
  expectedOutput: {
    format: typeof COURSE_BUNDLE_FORMAT;
    version: typeof COURSE_BUNDLE_VERSION;
  };
};

function bytesToHex(bytes: Uint8Array) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function fingerprintFile(
  file: File,
  pageCount: number,
): Promise<SourceFingerprint> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    pageCount,
    sha256: bytesToHex(new Uint8Array(digest)),
  };
}

export async function buildHandoffPackage(input: {
  files: File[];
  documents: Array<{ fileName: string; pageCount: number }>;
  maps: Array<{
    fileName: string;
    starts: HandoffLessonStart[];
  }>;
  courseHint: {
    title: string;
    level: string;
    edition?: string;
  };
}): Promise<ChatGptHandoffPackage> {
  const sourceFiles = await Promise.all(
    input.files.map((file) => {
      const document = input.documents.find(
        (item) => item.fileName === file.name,
      );

      return fingerprintFile(file, document?.pageCount ?? 0);
    }),
  );

  return {
    format: CHATGPT_HANDOFF_FORMAT,
    version: CHATGPT_HANDOFF_VERSION,
    createdAt: new Date().toISOString(),
    sourceFiles,
    detectedMaps: input.maps.map((item) => ({
      fileName: item.fileName,
      starts: item.starts.map((start) => ({
        lessonId: start.lessonId,
        pageNumber: start.pageNumber,
        titleHint: start.titleHint || undefined,
      })),
    })),
    courseHint: input.courseHint,
    expectedOutput: {
      format: COURSE_BUNDLE_FORMAT,
      version: COURSE_BUNDLE_VERSION,
    },
  };
}

export function buildChatGptCompilationPrompt() {
  return [
    "Tôi đang dùng dự án Haneul học tiếng Hàn.",
    "Hãy đọc toàn bộ PDF giáo trình/workbook tôi tải lên cùng file haneul-chatgpt-handoff.json.",
    "Biên nội dung bám sát sách thành Haneul Course Bundle v1.",
    "Yêu cầu:",
    "- Không thêm curriculum ngoài sách.",
    "- Bao phủ từ vựng, ngữ pháp, hội thoại, phát âm, văn hóa, nghe, nói, đọc, viết và bài tập nếu có.",
    "- Mỗi nội dung quan trọng giữ sourceRef theo file/trang.",
    "- Bài luyện derived chỉ dùng kiến thức đã xuất hiện trong nguồn.",
    "- Sao chép nguyên sourceFiles từ handoff sang sourceManifest của bundle để app xác minh đúng PDF.",
    "- Xuất một file JSON duy nhất đúng format haneul-course-bundle version 1 để tôi import vào app.",
  ].join("\n");
}

export function handoffPackageFile(
  value: ChatGptHandoffPackage,
) {
  return new File(
    [JSON.stringify(value, null, 2)],
    "haneul-chatgpt-handoff.json",
    { type: "application/json" },
  );
}

export function downloadJsonFile(
  fileName: string,
  value: unknown,
) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
