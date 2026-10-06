"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Headphones,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { EmptySkillState } from "@/components/empty-skill-state";

export function PronunciationLab({ lessonId = 1 }: { lessonId?: number }) {
  const { getLesson, course } = useContent();
  const { recordAnswer } = useLearning();
  const lesson = getLesson(lessonId);
  const items = lesson?.pronunciation ?? [];
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  if (!lesson || !items.length) {
    return <EmptySkillState lessonId={lessonId} skill="Phát âm" />;
  }

  function speak(text: string, rate = 0.76) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }

  function markPracticed(id: string) {
    if (completedIds.includes(id)) return;
    setCompletedIds((current) => [...current, id]);
    recordAnswer("speaking", true, "pronunciation:" + id);
  }

  return (
    <div className="pronunciation-lab-v4">
      <header className="pronunciation-head-v4">
        <div>
          <span className="experience-kicker">PRONUNCIATION LAB · BÀI {lessonId}</span>
          <h1>Nghe rõ, bắt chước chậm, rồi tăng tốc.</h1>
          <p>
            Mỗi quy tắc phát âm được giữ đúng theo nội dung giáo trình và luyện bằng ví dụ nguồn.
          </p>
        </div>
        <Link className="secondary-button" href={"/learn/" + lessonId}>
          <ArrowLeft size={16} /> Về bài học
        </Link>
      </header>

      <section className="pronunciation-grid-v4">
        {items.map((item, index) => {
          const practiced = completedIds.includes(item.id);

          return (
            <article className="pronunciation-card-v4" key={item.id}>
              <div className="pronunciation-number-v4">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="pronunciation-copy-v4">
                <span>발음</span>
                <h2>{item.title}</h2>
                <p>{item.explanation}</p>

                <div className="pronunciation-examples-v4">
                  {item.examples.map((example) => (
                    <div key={example}>
                      <strong className="korean-text">{example}</strong>
                      <div>
                        <button
                          className="secondary-button"
                          onClick={() => speak(example)}
                          type="button"
                        >
                          <Volume2 size={15} /> Nghe
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() => speak(example, 0.55)}
                          type="button"
                        >
                          <Headphones size={15} /> Chậm
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pronunciation-card-footer-v4">
                  {item.sourceRef ? (
                    <small className="source-ref">{item.sourceRef}</small>
                  ) : <span />}
                  <button
                    className={practiced ? "secondary-button done" : "primary-button"}
                    disabled={practiced}
                    onClick={() => markPracticed(item.id)}
                    type="button"
                  >
                    {practiced ? (
                      <>
                        <CheckCircle2 size={16} /> Đã luyện
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Đánh dấu đã luyện
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
