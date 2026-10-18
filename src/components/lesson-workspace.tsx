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
import { GrammarExplanation } from "./grammar-explanation";
import { useMessages } from "@/i18n/messages";
import { auditLessonPracticeCoverage } from "@/lib/practice-coverage";
import { summarizeLessonPractice } from "@/lib/lesson-practice-bank";
import { isCurrentCompleteCoverage } from "@/lib/curriculum-coverage";
import {
  getCoreLessonProgress,
  getRequiredCoreSkills,
} from "@/lib/lesson-completion";

type LessonTabKey = "overview" | "vocabulary" | "grammar" | "reading" | "supplement";
const tabKeys: LessonTabKey[] = ["overview", "vocabulary", "grammar", "reading", "supplement"];


export function LessonWorkspace({ lessonId }: { lessonId: number }) {
  const [tab, setTab] = useState<LessonTabKey>("overview");
  const { state } = useLearning();
  const messages = useMessages();
  const { getLesson, course, hydrated } = useContent();
  const lesson = getLesson(lessonId);

  if (!hydrated) return <p role="status">Đang mở nội dung bài học…</p>;

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

  const requiredCoreSkills = getRequiredCoreSkills({
    hasVocabulary: lesson.vocabulary.length > 0,
    hasGrammar: lesson.grammar.length > 0,
  });
  const progress = getCoreLessonProgress(
    state.completedActivities,
    lessonId,
    requiredCoreSkills,
  );
  const coreComplete = progress >= 100;
  const evidence = auditLessonPracticeCoverage(lesson, course.questions);
  const contentCounts = summarizeLessonPractice(lesson, course.questions);
  const curriculumCoverage = course.source?.curriculumCoverage;
  const hasInventoriedUnits = (curriculumCoverage?.sourceCoverage.total ?? 0) > 0;

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
      required: true,
      ko: "어휘",
      title: "Khởi động từ vựng",
      desc: lesson.vocabulary.length + " từ/cụm từ trọng tâm",
      href: "/vocabulary?lesson=" + lessonId,
      available: lesson.vocabulary.length > 0,
    },
    {
      skill: "grammar",
      required: true,
      ko: "문법",
      title: "Nắm mẫu câu",
      desc: lesson.grammar.length + " điểm ngữ pháp + câu luyện trộn",
      href: "/grammar?lesson=" + lessonId,
      available: lesson.grammar.length > 0,
    },
    {
      skill: "listening",
      required: false,
      ko: "듣기",
      title: "Nghe và bắt ý",
      desc: lesson.listening.length + " lượt nghe có phản hồi",
      href: "/listening?lesson=" + lessonId,
      available: lesson.listening.length > 0,
    },
    {
      skill: "speaking",
      required: false,
      ko: "말하기",
      title: "Nói thành phản xạ",
      desc: lesson.speaking.length + " câu shadowing",
      href: "/speaking?lesson=" + lessonId,
      available: lesson.speaking.length > 0,
    },
    {
      skill: "reading",
      required: false,
      ko: "읽기",
      title: "Đọc trong ngữ cảnh",
      desc: lesson.reading ? "1 bài đọc + câu hỏi hiểu bài" : "Chưa có bài đọc",
      href: "/reading?lesson=" + lessonId,
      available: Boolean(lesson.reading),
    },
    {
      skill: "writing",
      required: false,
      ko: "쓰기",
      title: "Dùng ngôn ngữ để viết",
      desc: lesson.writing ? "1 nhiệm vụ viết có checklist" : "Chưa có bài viết",
      href: "/writing?lesson=" + lessonId,
      available: Boolean(lesson.writing),
    },
  ].filter((step) => step.available);

  const isMissionDone = (skill: string) =>
    state.completedActivities.includes("lesson:" + lessonId + ":" + skill);
  const completedCoreMissions = missionSteps.filter(
    (step) => step.required && isMissionDone(step.skill),
  ).length;
  const optionalCompleted = missionSteps.filter(
    (step) => !step.required && isMissionDone(step.skill),
  ).length;
  const nextMission =
    missionSteps.find(
      (step) => step.required && !isMissionDone(step.skill),
    ) ?? missionSteps.find((step) => !isMissionDone(step.skill)) ?? missionSteps[0];
  const lessonIndex = course.lessons.findIndex((item) => item.id === lessonId);
  const nextLesson =
    lessonIndex >= 0 ? course.lessons[lessonIndex + 1] : undefined;
  const primaryNextHref = coreComplete
    ? nextLesson
      ? "/learn/" + nextLesson.id
      : "/review"
    : nextMission?.href ?? ("/practice/quiz?lesson=" + lessonId + "&mode=guided");
  const primaryNextLabel = coreComplete
    ? nextLesson
      ? "Sang Bài " + nextLesson.id
      : "Ôn lại giáo trình"
    : progress
      ? "Tiếp tục phần cốt lõi"
      : "Bắt đầu bài học";

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
                AI tự đánh giá nguồn: {lesson.quality.groundingScore}%
              </span>
            ) : null}
          </div>
        </div>
        <div className="lesson-header-actions">
          <span className="lesson-progress-pill">{progress}% phần cốt lõi</span>
          <Link
            className="primary-button"
            href={primaryNextHref}
          >
            <Play size={17} /> {primaryNextLabel}
          </Link>
          <Link className="secondary-button" href={nextLesson ? "/learn/" + nextLesson.id : "/learn"}>
            {nextLesson ? "Sang Bài " + nextLesson.id : "Chọn bài khác"}
          </Link>
        </div>
      </header>

      <p><Link className="secondary-button" href={"/sources?page=" + (lesson.sourceRef?.match(/\bpp?\.(\d+)/)?.[1] ?? 1)}><BookOpen size={17} /> Đối chiếu toàn bộ giáo trình gốc</Link></p>
      <p><Link className="secondary-button" href={"/practice/workbook?lesson=" + lessonId}><PenLine size={17} /> Luyện toàn bộ nội dung bài</Link></p>

      <details className="source-evidence-panel">
        <summary>Nội dung đã nhập · {isCurrentCompleteCoverage(curriculumCoverage) ? "Đã đối chiếu inventory nguồn" : "Chưa xác minh độ đầy đủ của sách"}</summary>
        <p>Tiến độ học và số câu luyện không chứng minh sách đã được biên soạn đầy đủ. {hasInventoriedUnits ? "Kết quả dưới đây đối chiếu với inventory nguồn đã cung cấp; nội dung nguồn vẫn cần người kiểm tra." : "Tổng số mục trong giáo trình gốc chưa được kiểm kê độc lập."}</p>
        {curriculumCoverage && hasInventoriedUnits ? <p>
          Nội dung nguồn: {curriculumCoverage.sourceCoverage.covered}/{curriculumCoverage.sourceCoverage.total} ·
          Có cách ôn: {curriculumCoverage.practiceCoverage.covered}/{curriculumCoverage.practiceCoverage.total} ·
          Đã kiểm chứng: {curriculumCoverage.validationCoverage.covered}/{curriculumCoverage.validationCoverage.total}.
        </p> : null}
        {curriculumCoverage?.issues.length ? <p>{curriculumCoverage.issues.join(" · ")}</p> : null}
        <dl>
          <div><dt>Từ vựng</dt><dd>{contentCounts.vocabulary}</dd></div>
          <div><dt>Ngữ pháp / ví dụ</dt><dd>{contentCounts.grammar} / {contentCounts.grammarExamples}</dd></div>
          <div><dt>Dòng hội thoại</dt><dd>{contentCounts.dialogueLines}</dd></div>
          <div><dt>Câu đọc hiểu / nghe</dt><dd>{contentCounts.reading} / {contentCounts.listening}</dd></div>
          <div><dt>Câu hỏi đã nhập</dt><dd>{contentCounts.sourceQuestions}</dd></div>
          <div><dt>Bài luyện tạo thêm</dt><dd>{contentCounts.derivedQuestions}</dd></div>
        </dl>
        <p>{evidence.verifiedItems}/{evidence.sourceItems} mục trong dữ liệu hiện có được nối với câu hỏi qua nguồn riêng biệt. {evidence.ambiguous.length} mục có nguồn chung chưa đủ để đối chiếu.</p>
        {evidence.uncovered.length ? <p className="source-evidence-missing">Cần đối chiếu: {evidence.uncovered.map(item => item.key).join(", ")}</p> : null}
        <Link className="text-button" href={"/practice/workbook?lesson=" + lessonId}>Mở toàn bộ nội dung và bài tập đã nhập</Link>
      </details>

      {coreComplete ? (
        <section className="lesson-complete-banner-v4">
          <div className="lesson-complete-icon-v4">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <span className="experience-kicker">CORE COMPLETE</span>
            <h2>Bạn đã nắm phần cốt lõi của Bài {lessonId}.</h2>
            <p>
              Bạn có thể ôn sâu hơn hoặc học bài khác bất cứ lúc nào. Mọi bài đều mở sẵn, không phụ thuộc điểm số hay thiết bị.
            </p>
          </div>
          <div className="lesson-complete-actions-v4">
            <Link
              className="secondary-button"
              href={"/practice/quiz?lesson=" + lessonId + "&mode=mastery"}
            >
              Mastery Check
            </Link>
            {nextLesson ? (
              <Link className="primary-button" href={"/learn/" + nextLesson.id}>
                Sang Bài {nextLesson.id}
              </Link>
            ) : (
              <Link className="primary-button" href="/review">
                Ôn lại giáo trình
              </Link>
            )}
          </div>
        </section>
      ) : null}

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
                Chọn phần bạn cần học hôm nay. Mọi bài đều mở sẵn; không cần hoàn thành
                bài này để sang bài khác. Không có mic hay bàn phím tiếng Hàn vẫn ôn được.
              </p>

              <div className="lesson-mission-progress-v3">
                <div>
                  <span style={{ width: progress + "%" }} />
                </div>
                <strong>{progress}%</strong>
              </div>

              <div className="lesson-mission-actions-v3">
                <Link className="primary-button" href={primaryNextHref}>
                  <Sparkles size={17} />
                  {coreComplete
                    ? primaryNextLabel
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
              <span>CORE</span>
              <strong>{completedCoreMissions}/{requiredCoreSkills.length}</strong>
              <small>{optionalCompleted} chặng tùy chọn đã làm</small>
            </div>
          </article>

          <div className="lesson-road-v3">
            {missionSteps.map((step, index) => {
              const done = isMissionDone(step.skill);
              const current =
                !done &&
                step.required &&
                nextMission?.skill === step.skill;

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
                    {done
                      ? "Xong"
                      : current
                        ? "Tiếp theo"
                        : step.required
                          ? <Circle size={12} />
                          : "Tùy chọn"}
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
              <span><strong>{contentCounts.totalQuestions}</strong> câu luyện</span>
            </div>
          </aside>

          {dialogues.length || pronunciation.length ? (
            <section className="lesson-immersion-v4">
              <div className="section-head-v2">
                <div>
                  <span className="experience-kicker">IMMERSION BONUS</span>
                  <h2>Dùng tiếng Hàn gần với tình huống thật</h2>
                </div>
              </div>
              <div className="lesson-immersion-grid-v4">
                {dialogues.length ? (
                  <Link
                    className="lesson-immersion-card-v4 conversation"
                    href={"/conversation?lesson=" + lessonId}
                  >
                    <span className="lesson-immersion-icon-v4">
                      <MessageCircle size={23} />
                    </span>
                    <div>
                      <span>대화 · HỘI THOẠI</span>
                      <h3>Luyện theo vai</h3>
                      <p>{dialogues.length} đoạn hội thoại từ giáo trình.</p>
                    </div>
                  </Link>
                ) : null}

                {pronunciation.length ? (
                  <Link
                    className="lesson-immersion-card-v4 pronunciation"
                    href={"/pronunciation?lesson=" + lessonId}
                  >
                    <span className="lesson-immersion-icon-v4">
                      <Volume2 size={23} />
                    </span>
                    <div>
                      <span>발음 · PHÁT ÂM</span>
                      <h3>Nghe chậm & bắt chước</h3>
                      <p>{pronunciation.length} điểm phát âm cần chú ý.</p>
                    </div>
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}
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
                <GrammarExplanation item={grammar} onSpeak={speak} />
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
