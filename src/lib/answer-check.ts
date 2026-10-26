export function normalizeAnswer(value: string) {
  return value.normalize("NFC").trim().replace(/[.!?。！？]/g, "").replace(/\s+/g, " ").toLocaleLowerCase();
}
export function answersMatch(answer: string, expected: string) {
  return Boolean(answer.trim()) && normalizeAnswer(answer) === normalizeAnswer(expected);
}
export function normalizeChoiceAnswer(value: string) {
  return value.normalize("NFC").trim();
}
export function choiceAnswersMatch(answer: string, expected: string) {
  return Boolean(answer.trim()) && normalizeChoiceAnswer(answer) === normalizeChoiceAnswer(expected);
}
export function availableTokenIndexes(tokens: string[], chosen: number[]) {
  return tokens.map((_, index) => index).filter(index => !chosen.includes(index));
}
