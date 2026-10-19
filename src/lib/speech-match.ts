function normalizeSpeech(value: string) {
  return [...value.normalize("NFC").toLowerCase().replace(/[\s.!?。！？]/g, "")];
}
// This compares the recognizer's text, not pronunciation or prosody.
export function speechMatchScore(actual: string, expected: string) {
  const left = normalizeSpeech(actual);
  const right = normalizeSpeech(expected);
  if (!left.length || !right.length) return 0;
  let previous = right.map((_, index) => index + 1);
  previous.unshift(0);
  for (let i = 0; i < left.length; i++) {
    const row = [i + 1];
    for (let j = 0; j < right.length; j++) row[j + 1] = Math.min(row[j] + 1, previous[j + 1] + 1, previous[j] + Number(left[i] !== right[j]));
    previous = row;
  }
  return Math.round((1 - previous[right.length] / Math.max(left.length, right.length)) * 100);
}
