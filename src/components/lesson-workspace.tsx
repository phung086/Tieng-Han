"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Headphones,
  MessageCircle,
  Mic2,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useContent } from "@/lib/content-store";
import { useLearning } from "@/lib/learning-state";
import { LessonMediaGallery } from "@/components/lesson-media-gallery";
import { useMessages } from "@/i18n/messages";

type LessonTabKey = "overview" | "vocabulary" | "grammar" | "reading" | "supplement";
const tabKeys: LessonTabKey[] = ["overview", "vocabulary", "grammar", "reading", "supplement"];


export function LessonWorkspace({ lessonId }: { lessonId: number }) {
  const [tab, setTab] = useState<LessonTabKey>("overview");
  const { state } = useLearning();
  const messages = useMessages();
  const { getLesson, course } = useContent();
  const lesson = getLesson(lessonId);
  const progress = state.lessonProgress[String(lessonId)] ?? 0;

  if (!lesson) {
    return (
      <div className="empty-lesson">
        <span className="eyebrow">{messages.lesson.notFound}</span>
        <h1>{messages.common.lesson} {lessonId}</h1>
        <p>{messages.lesson.notFoundBody}</p>
        <Link className="primary-button" href="/learn">{messages.lesson.backCourse}</Link>
      </div>
    );
  }

  const dialogues = lesson.dialogues ?? [];
  const pronunciation = lesson.pronunciation ?? [];
  const culture = lesson.culture ?? [];
  const extraSections = lesson.extraSections ?? [];
  const media = lesson.media ?? [];
  const supplementalCount =
    dialogues.length +
    pronunciation.length +
    culture.length +
    extraSections.length +
    media.length;

  const missionSteps = [
    {
      skill: "vocabulary",
      ko: "어휘",
      title: "Khởi động từ vựng",
      desc: lesson.vocabulary.length + " từ/cụm từ trọng tâm",
      href: "/vocabulary?lesson=" + lessonId,
      available: lesson.vocabulary.length > 0,
    },
    {
      skill: "grammar",
      ko: "문법",
      title: "Nắm mẫu câu",
      desc: lesson.grammar.length + " điểm ngữ pháp + câu luyện trộn",
      href: "/grammar?lesson=" + lessonId,
      available: lesson.grammar.length > 0,
    },
    {
      skill: "listening",
      ko: "듣기",
      title: "Nghe và bắt ý",
      desc: lesson.listening.length + " lượt nghe có phản hồi",
      href: "/listening?lesson=" + lessonId,
      available: lesson.listening.length > 0,
    },
    {
      skill: "speaking",
      ko: "말하기",
      title: "Nói thành phản xạ",
      desc: lesson.speaking.length + " câu shadowing",
      href: "/speaking?lesson=" + lessonId,
      available: lesson.speaking.length > 0,
    },
    {
      skill: "reading",
      ko: "읽기",
      title: "Đọc trong ngữ cảnh",
      desc: lesson.reading ? "1 bài đọc + câu hỏi hiểu bài" : "Chưa có bài đọc",
      href: "/reading?lesson=" + lessonId,
      available: Boolean(lesson.reading),
    },
    {
      skill: "writing",
      ko: "쓰기",
      title: "Dùng ngôn ngữ để viết",
      desc: lesson.writing ? "1 nhiệm vụ viết có checklist" : "Chưa có bài viết",
      href: "/writing?lesson=" + lessonId,
      available: Boolean(lesson.writing),
    },
  ].filter((step) => step.available);

  const isMissionDone = (skill: string) =>
    state.completedActivities.includes("lesson:" + lessonId + ":" + skill);
  const completedMissions = missionSteps.filter((step) =>
    isMissionDone(step.skill),
  ).length;
  const nextMission =
    missionSteps.find((step) => !isMissionDone(step.skill)) ??
    missionSteps[0];

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = course.language?.locale ?? "ko-KR";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="lesson-workspace">
      <header className="lesson-workspace-header">
        <div>
          <span className="kicker">{course.level} · {messages.common.lesson.toUpperCase()} {lessonId}</span>
          <h1 className="korean-text">{lesson.title}</h1>
          <p>{lesson.vi} · {lesson.objective}</p>
          <div className="lesson-source-line">
            {lesson.sourceRef ? <span>{lesson.sourceRef}</span> : null}
            {lesson.quality ? (
              <span className="grounding-badge">
                <ShieldCheck size={13} />
                {messages.lesson.grounding} {lesson.quality.groundingScore}%
              </span>
            ) : null}
          </div>
        </div>
        <div className="lesson-header-actions">
          <span className="lesson-progress-pill">{progress}% {messages.lesson.completed}</span>
          <Link
            className="primary-button"
            href={nextMission?.href ?? ("/practice/quiz?lesson=" + lessonId + "&mode=guided")}
          >
            <Play size={17} /> {progress ? "Tiếp tục bài" : "Bắt đầu bài học"}
          </Link>
        </div>
      </header>

      <nav className="lesson-tabs" aria-label={messages.common.textbook}>
        {tabKeys.map((key) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            {messages.lesson.tabs[key]}
            {key === "supplement" && supplementalCount ? (
              <span className="tab-count">{supplementalCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <section className="lesson-overview-v3">
          <article className="lesson-mission-hero-v3">
            <div className="lesson-mission-copy-v3">
              <span className="experience-kicker">LESSON MISSION</span>
              <h2>{lesson.objective}</h2>
              <p>
                Học theo từng chặng ngắn: nhận biết → hiểu → luyện → dùng → ôn lại.
                Bạn có thể dừng bất cứ lúc nào và quay lại đúng bước đang học.
              </p>

              <div className="lesson-mission-progress-v3">
                <div>
                  <span style={{ width: progress + "%" }} />
                </div>
                <strong>{progress}%</strong>
              </div>

              <div className="lesson-mission-actions-v3">
                <Link
                  className="primary-button"
                  href={nextMission?.href ?? ("/practice/quiz?lesson=" + lessonId + "&mode=guided")}
                >
                  <Sparkles size={17} />
                  {completedMissions === missionSteps.length
                    ? "Luyện lại bài"
                    : "Tiếp tục: " + (nextMission?.title ?? "Bài học nhanh")}
                </Link>
                <Link
                  className="secondary-button"
                  href={"/practice/quiz?lesson=" + lessonId + "&mode=quick"}
                >
                  Quick 5
                </Link>
              </div>
            </div>

            <div className="lesson-mission-score-v3">
              <span>MISSION</span>
              <strong>{completedMissions}/{missionSteps.length}</strong>
              <small>chặng đã hoàn thành</small>
            </div>
          </article>

          <div className="lesson-road-v3">
            {missionSteps.map((step, index) => {
              const done = isMissionDone(step.skill);
              const current = !done && nextMission?.skill === step.skill;

              return (
                <Link
                  className={
                    "lesson-road-step-v3" +
                    (done ? " done" : "") +
                    (current ? " current" : "")
                  }
                  href={step.href}
                  key={step.skill}
                >
                  <div className="lesson-road-index-v3">
                    {done ? (
                      <CheckCircle2 size={22} />
                    ) : (
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    )}
                  </div>
                  <div>
                    <span>{step.ko}</span>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </div>
                  <div className="lesson-road-status-v3">
                    {done ? "Xong" : current ? "Tiếp theo" : <Circle size={12} />}
                  </div>
                </Link>
              );
            })}
          </div>

          <aside className="lesson-coach-v3">
            <div>
              <span className="experience-kicker">SMART PACE</span>
              <h3>Một bài không cần học hết trong một lần.</h3>
              <p>
                Học 10–15 phút, nhận phản hồi ngay, rồi quay lại bằng hàng đợi ôn tập.
                Haneul ưu tiên điểm yếu thay vì bắt bạn lặp cả bài.
              </p>
            </div>
            <div className="lesson-coach-stats-v3">
              <span><strong>{lesson.vocabulary.length}</strong> từ</span>
              <span><strong>{lesson.grammar.length}</strong> mẫu câu</span>
              <span><strong>{course.questions.filter((q) => q.lessonId === lessonId).length}</strong> câu luyện</span>
            </div>
          </aside>
        </section>
      ) : null}

      {tab === "vocabulary" ? (
        <section className="lesson-content-card">
          <div className="content-heading">
            <div><span className="eyebrow">어휘</span><h2>{messages.lesson.vocabTitle}</h2></div>
            <Link className="secondary-button" href={"/vocabulary?lesson=" + lessonId}>{messages.lesson.openFlashcards}</Link>
          </div>
          {lesson.vocabulary.length ? (
            <div className="lesson-vocab-grid">
              {lesson.vocabulary.map((word) => (
                <article key={word.id}>
                  <button onClick={() => speak(word.ko)} aria-label={messages.vocabulary.hearPronunciation + " " + word.ko}><Volume2 size={16} /></button>
                  <strong className="korean-text">{word.ko}</strong>
                  <span>{word.vi}</span>
                  <p className="korean-text">{word.example}</p>
                  {word.sourceRef ? <small className="source-ref">{word.sourceRef}</small> : null}
                </article>
              ))}
            </div>
          ) : <div className="inline-empty-state">{messages.lesson.noVocabulary}</div>}
        </section>
      ) : null}

      {tab === "grammar" ? (
        <section className="grammar-stack">
          {lesson.grammar.length ? lesson.grammar.map((grammar, index) => (
            <article className="grammar-card" key={grammar.id}>
              <div className="grammar-number">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <span className="eyebrow">문법</span>
                <h2>{grammar.pattern}</h2>
                <strong>{grammar.meaning}</strong>
                <p>{grammar.explanation}</p>
                <div className="grammar-examples">
                  {grammar.examples.map((example) => (
                    <button className="korean-text" onClick={() => speak(example)} key={example}>
                      <Volume2 size={15} /> {example}
                    </button>
                  ))}
                </div>
                {grammar.sourceRef ? <small className="source-ref">{grammar.sourceRef}</small> : null}
              </div>
            </article>
          )) : <div className="inline-empty-state">{messages.lesson.noGrammar}</div>}
        </section>
      ) : null}

      {tab === "reading" ? (
        lesson.reading ? (
          <section className="reading-card">
            <div className="reading-label"><BookOpen size={19} /><span>읽기</span></div>
            <h2>{lesson.reading.title}</h2>
            <p className="reading-korean korean-text">{lesson.reading.text}</p>
            {lesson.reading.sourceRef ? <small className="source-ref">{lesson.reading.sourceRef}</small> : null}
            <details><summary>{messages.lesson.showTranslation}</summary><p>{lesson.reading.translation}</p></details>
            <div className="reading-actions">
              <Link className="secondary-button" href={"/reading?lesson=" + lessonId}><BookOpen size={16} /> {messages.lesson.readingPractice}</Link>
              <Link className="secondary-button" href={"/listening?lesson=" + lessonId}><Headphones size={16} /> {messages.lesson.listeningPractice}</Link>
              <Link className="secondary-button" href={"/speaking?lesson=" + lessonId}><Mic2 size={16} /> {messages.lesson.speakingPractice}</Link>
              <Link className="secondary-button" href={"/writing?lesson=" + lessonId}><PenLine size={16} /> {messages.lesson.writingPractice}</Link>
            </div>
          </section>
        ) : <div className="inline-empty-state">{messages.lesson.noReading}</div>
      ) : null}

      {tab === "supplement" ? (
        <section className="supplement-stack">
          <LessonMediaGallery media={media} />
          {!supplementalCount ? (
            <div className="inline-empty-state">{messages.lesson.noSupplement}</div>
          ) : null}

          {dialogues.map((dialogue) => (
            <article className="supplement-card" key={dialogue.id}>
              <div className="supplement-heading"><MessageCircle size={20} /><div><span className="eyebrow">{messages.lesson.dialogue}</span><h2>{dialogue.title || messages.lesson.dialogueTitle}</h2></div></div>
              <div className="dialogue-lines">
                {dialogue.lines.map((line, index) => (
                  <button key={dialogue.id + "-" + index} onClick={() => speak(line.ko)}>
                    <span>{line.speaker || String(index + 1)}</span>
                    <div><strong className="korean-text">{line.ko}</strong>{line.vi ? <small>{line.vi}</small> : null}</div>
                    <Volume2 size={15} />
                  </button>
                ))}
              </div>
              {dialogue.sourceRef ? <small className="source-ref">{dialogue.sourceRef}</small> : null}
            </article>
          ))}

          {pronunciation.map((item) => (
            <article className="supplement-card" key={item.id}>
              <div className="supplement-heading"><Volume2 size={20} /><div><span className="eyebrow">{messages.lesson.pronunciation}</span><h2>{item.title}</h2></div></div>
              <p>{item.explanation}</p>
              <div className="grammar-examples">{item.examples.map((example) => <button className="korean-text" key={example} onClick={() => speak(example)}><Volume2 size={15} /> {example}</button>)}</div>
              {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
            </article>
          ))}

          {culture.map((item) => (
            <article className="supplement-card" key={item.id}>
              <div className="supplement-heading"><BookOpen size={20} /><div><span className="eyebrow">{messages.lesson.culture}</span><h2>{item.title}</h2></div></div>
              <p>{item.text}</p>
              {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
            </article>
          ))}

          {extraSections.map((item) => (
            <article className="supplement-card" key={item.id}>
              <div className="supplement-heading"><FileText size={20} /><div><span className="eyebrow">{item.kind}</span><h2>{item.title}</h2></div></div>
              <div className="extra-content">{item.content.map((line, index) => <p key={item.id + "-" + index}>{line}</p>)}</div>
              {item.sourceRef ? <small className="source-ref">{item.sourceRef}</small> : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
