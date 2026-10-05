export const ingestionConfig = {
  pdf: {
    lowTextCharacters: 80,
    ocrTriggerRatio: 0.35,
    previewScale: 0.9,
    previewJpegQuality: 0.72,
    maxPreviewWidth: 1100,
    minEmbeddedImagePixels: 40_000,
    maxEmbeddedImagesPerPage: 12,
  },
  lesson: {
    initialVisibleMediaItems: 6,
    maxVisionPagesPerLesson: 8,
  },
  validation: {
    minimumCoverage: 75,
    minimumGrounding: 85,
    passCoverage: 82,
    passGrounding: 90,
  },
} as const;
