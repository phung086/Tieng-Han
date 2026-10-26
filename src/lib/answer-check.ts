export function normalizeReorderAnswer(value: string) {
  return value.normalize("NFC").trim().replace(/[.!?。！？]/g, "").replace(/\s+/g, " ");
}

export function normalizeAnswer(value: string) {
  return normalizeReorderAnswer(value).toLocaleLowerCase();
}
export function answersMatch(answer: string, expected: string) {
  return Boolean(answer.trim()) && normalizeAnswer(answer) === normalizeAnswer(expected);
}
export function availableTokenIndexes(tokens: string[], chosen: number[]) {
  return tokens.map((_, index) => index).filter(index => !chosen.includes(index));
}
