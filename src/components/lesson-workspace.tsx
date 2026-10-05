"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  Headphones,
  MessageCircle,
  Mic2,
  PenLine,
  Play,
  ShieldCheck,
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
          <Link className="primary-button" href={"/practice/quiz?lesson=" + lessonId}>
            <Play size={17} /> {messages.lesson.practiceLesson}
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
        <section className="lesson-overview-grid">
          <article className="lesson-main-card">
            <span className="eyebrow">{messages.lesson.objective}</span>
            <h2>{lesson.objective}</h2>
            <p>{messages.lesson.progressNote}</p>
            <div className="lesson-step-list">
              <button onClick={() => setTab("vocabulary")}>
                <span>01</span><div><strong>어휘 · {messages.lesson.vocabulary}</strong><small>{lesson.vocabulary.length} {messages.lesson.items}</small></div>
              </button>
              <button onClick={() => setTab("grammar")}>
                <span>02</span><div><strong>문법 · {messages.lesson.grammar}</strong><small>{lesson.grammar.length} {messages.lesson.points}</small></div>
              </button>
              <Link href={"/listening?lesson=" + lessonId}>
                <span>03</span><div><strong>듣기 · {messages.lesson.listening}</strong><small>{lesson.listening.length} {messages.lesson.exercises}</small></div>
              </Link>
              <Link href={"/speaking?lesson=" + lessonId}>
                <span>04</span><div><strong>말하기 · {messages.lesson.speaking}</strong><small>{lesson.speaking.length} {messages.lesson.sentences}</small></div>
              </Link>
              <button onClick={() => setTab("reading")}>
                <span>05</span><div><strong>읽기 · {messages.lesson.reading}</strong><small>{lesson.reading ? messages.lesson.oneReading : messages.lesson.none}</small></div>
              </button>
              <Link href={"/writing?lesson=" + lessonId}>
                <span>06</span><div><strong>쓰기 · {messages.lesson.writing}</strong><small>{lesson.writing ? messages.lesson.oneWriting : messages.lesson.none}</small></div>
              </Link>
              {supplementalCount ? (
                <button onClick={() => setTab("supplement")}>
                  <span>+</span><div><strong>교재 · {messages.lesson.extra}</strong><small>{supplementalCount} {messages.lesson.supplementItems}</small></div>
                </button>
              ) : null}
            </div>
          </article>

          <aside className="lesson-side-card">
            <span className="eyebrow">{messages.lesson.suggestedPace}</span>
            <h3>{messages.lesson.duration}</h3>
            <div className="time-plan"><span>5’</span><p>{messages.lesson.vocabulary}</p></div>
            <div className="time-plan"><span>7’</span><p>{messages.lesson.grammar}</p></div>
            <div className="time-plan"><span>8’</span><p>{messages.lesson.listening} + {messages.lesson.speaking}</p></div>
            <div className="time-plan"><span>10’</span><p>{messages.lesson.reading} + {messages.lesson.writing}</p></div>
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
