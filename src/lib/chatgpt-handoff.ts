import {
  COURSE_BUNDLE_FORMAT,
  COURSE_BUNDLE_VERSION,
  type CompiledCourseBundle,
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

export type BundleSourceVerification =
  | { status: "verified" }
  | { status: "unverified" }
  | { status: "mismatch"; files: string[] };

function bytesToHex(bytes: Uint8Array) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^p{L}p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sameFingerprint(
  left: SourceFingerprint,
  right: SourceFingerprint,
) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified &&
    left.pageCount === right.pageCount &&
    left.sha256 === right.sha256
  );
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

export function handoffFileName(courseTitle: string) {
  const base = normalizeTitle(courseTitle) || "haneul-course";
  return base + ".haneul-handoff.json";
}

export function buildChatGptPrompt(handoff: ChatGptHandoffPackage) {
  const sources = handoff.sourceFiles
    .map(
      (file) =>
        "- " +
        file.name +
        " · " +
        file.pageCount +
        " pages · sha256 " +
        file.sha256,
    )
    .join("\n");

  const detectedLessons = handoff.detectedMaps
    .map((map) => {
      const starts = map.starts.length
        ? map.starts
            .map(
              (item) =>
                "Bài " +
                item.lessonId +
                ": p." +
                item.pageNumber +
                (item.titleHint ? " · " + item.titleHint : ""),
            )
            .join("; ")
        : "chưa có lesson map local";
      return "- " + map.fileName + ": " + starts;
    })
    .join("\n");

  return [
    "Hãy biên bộ PDF tôi đính kèm thành Haneul Course Bundle cho ứng dụng học tiếng Hàn.",
    "Tôi cũng đính kèm file haneul-chatgpt-handoff. Hãy coi file đó là manifest nguồn và lesson-map gợi ý, nhưng vẫn đọc trực tiếp toàn bộ PDF để xác minh nội dung.",
    "",
    "Ràng buộc bắt buộc:",
    "1. Bám sát toàn bộ nội dung giáo trình; không tự viết một curriculum khác.",
    "2. Bao phủ tối đa từ vựng, ngữ pháp, hội thoại, phát âm, văn hóa, ghi chú, luyện tập và các section đặc biệt có trong sách.",
    "3. Tạo flow học đủ 6 kỹ năng Từ vựng / Ngữ pháp / Nghe / Nói / Đọc / Viết. Nếu sách thiếu Đọc/Viết riêng, chỉ tạo bài derived từ kiến thức thật sự có trong đúng bài đó.",
    "4. Mọi lesson/object quan trọng phải có sourceRef theo file và trang. Nội dung derived phải ghi Derived from <file · pages>.",
    "5. Không đưa kiến thức ngoài nguồn vào đáp án; distractor quiz không được biến thành curriculum mới.",
    "6. Giữ thứ tự bài học của giáo trình chính. Dùng workbook/tài liệu bổ sung để tăng practice cho bài tương ứng, không làm lệch lộ trình.",
    "7. Trường sourceManifest của output phải COPY CHÍNH XÁC mảng sourceFiles trong handoff để app xác minh đúng bộ PDF.",
    "8. Output phải là đúng Haneul Course Bundle format/version trong handoff. Trả về một file JSON hoàn chỉnh, không chỉ ví dụ rút gọn.",
    "9. Không nhúng base64 ảnh lớn vào JSON; app sẽ tự ghép ảnh/media từ PDF local dựa trên lesson map và sourceRef.",
    "10. Nếu một trang khó đọc, đánh dấu chất lượng/sourceRef rõ ràng thay vì bịa nội dung.",
    "",
    "Course hint:",
    "- title: " + handoff.courseHint.title,
    "- level: " + handoff.courseHint.level,
    "- edition: " + (handoff.courseHint.edition || "không xác định"),
    "",
    "Source manifest:",
    sources,
    "",
    "Lesson map local:",
    detectedLessons || "- chưa nhận diện được",
    "",
    "Khi hoàn tất, hãy tạo Haneul Course Bundle v" +
      handoff.expectedOutput.version +
      " với format \"" +
      handoff.expectedOutput.format +
      "\" để tôi tải về và import lại vào Haneul.",
  ].join("\n");
}

export function verifyBundleSource(
  bundle: CompiledCourseBundle,
  handoff: ChatGptHandoffPackage,
): BundleSourceVerification {
  const manifest = bundle.sourceManifest;

  if (!manifest?.length) {
    return { status: "unverified" };
  }

  const expectedByName = new Map(
    handoff.sourceFiles.map((item) => [item.name, item]),
  );
  const receivedByName = new Map(
    manifest.map((item) => [item.name, item]),
  );
  const mismatches = new Set<string>();

  if (expectedByName.size !== receivedByName.size) {
    for (const name of expectedByName.keys()) {
      if (!receivedByName.has(name)) mismatches.add(name);
    }
    for (const name of receivedByName.keys()) {
      if (!expectedByName.has(name)) mismatches.add(name);
    }
  }

  for (const [name, expected] of expectedByName) {
    const received = receivedByName.get(name);
    if (!received || !sameFingerprint(expected, received)) {
      mismatches.add(name);
    }
  }

  if (mismatches.size) {
    return {
      status: "mismatch",
      files: [...mismatches].sort(),
    };
  }

  return { status: "verified" };
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
