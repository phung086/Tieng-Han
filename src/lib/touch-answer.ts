export type AnswerPiece = { id: number; text: string };

/** Retains repeated words and punctuation; indices identify pieces, never their text. */
export function answerPieces(answer: string): { pieces: AnswerPiece[]; separator: string } {
  const normalized = answer.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  const separator = words.length > 1 ? " " : "";
  const parts = words.length > 1 ? words : Array.from(normalized);
  const pieces = parts.map((text, id) => ({ id, text }));
  // Stable, non-answer-order bank. No randomness during hydration.
  let seed = 2166136261;
  for (const char of normalized) seed = Math.imul(seed ^ char.codePointAt(0)!, 16777619);
  const bank = [...pieces];
  for (let i = bank.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
    const j = seed % (i + 1);
    [bank[i], bank[j]] = [bank[j], bank[i]];
  }
  if (bank.length > 1 && bank.every((piece, i) => piece.id === pieces[i].id)) bank.push(bank.shift()!);
  return { pieces: bank, separator };
}

export function assemblePieces(pieces: AnswerPiece[], selected: number[], separator: string) {
  const byId = new Map(pieces.map(piece => [piece.id, piece.text]));
  return selected.map(id => byId.get(id) ?? "").join(separator);
}
