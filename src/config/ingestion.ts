export const ingestionConfig = {
  pdf: {
    lowTextCharacters: 80,
    ocrTriggerRatio: 0.35,
    previewScale: 0.9,
    previewJpegQuality: 0.72,
    maxPreviewWidth: 1100,
  },
  lesson: {
    maxMediaItems: 12,
  },
  validation: {
    minimumCoverage: 75,
    minimumGrounding: 85,
    passCoverage: 82,
    passGrounding: 90,
  },
} as const;
