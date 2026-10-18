export const ingestionConfig = {
  autoImport: {
    enabled: true,
    targetLanguage: "ko",
    learnerLanguage: "vi",
    autoStartOnFileSelection: true,
    staleJobMinutes: 20,
  },
  pdf: {
    lowTextCharacters: 80,
    ocrTriggerRatio: 0.35,
    previewScale: 1.6,
    previewJpegQuality: 0.85,
    maxPreviewWidth: 1600,
    minEmbeddedImagePixels: 40_000,
  },
  lesson: {
    initialVisibleMediaItems: 6,
    maxVisionPagesPerLesson: 8,
  },
  validation: {
    minimumCoverage: 100,
    minimumGrounding: 100,
    passCoverage: 100,
    passGrounding: 100,
  },
} as const;
