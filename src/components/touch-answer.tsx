"use client";

import { useState } from "react";
import { answerPieces, assemblePieces } from "@/lib/touch-answer";
import styles from "./review-arcade.module.css";

export function TouchAnswer({ answer, disabled, onChange }: {
  answer: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const { pieces, separator } = answerPieces(answer);
  function change(next: number[]) {
    setSelected(next);
    onChange(assemblePieces(pieces, next, separator));
  }
  return <div className={styles.touch}>
    <p>Chạm để xếp đáp án. Chạm lại phần đã chọn để gỡ.</p>
    <div className={styles.built} aria-label="Đáp án đang xếp">
      {!selected.length ? <span>Chọn các mảnh bên dưới…</span> : selected.map((id, index) =>
        <button type="button" key={id} disabled={disabled} onClick={() => change(selected.filter((_, i) => i !== index))}>
          {pieces.find(piece => piece.id === id)?.text}
        </button>)}
    </div>
    <div className={styles.pieces} aria-label="Mảnh câu trả lời">
      {pieces.map(piece => <button type="button" key={piece.id} disabled={disabled || selected.includes(piece.id)}
        onClick={() => change([...selected, piece.id])}>{piece.text}</button>)}
    </div>
    <small>Chế độ có gợi ý: luyện nhận diện và thứ tự của câu.</small>
  </div>;
}
