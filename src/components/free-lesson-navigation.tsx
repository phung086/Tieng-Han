"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useContent } from "@/lib/content-store";
import styles from "./free-lesson-navigation.module.css";

export function FreeLessonNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { course, hydrated } = useContent();
  if (!hydrated || !course.lessons.length || !/^\/(learn\/\d+|vocabulary|grammar|listening|speaking|reading|writing|conversation|pronunciation|practice\/(quiz|drills|workbook))\/?$/.test(pathname)) return null;
  return <nav className={styles.nav} aria-label="Chuyển bài tự do">
    <label htmlFor="free-lesson-choice">Học theo nhịp của bạn</label>
    <select id="free-lesson-choice" value="" onChange={event => { if (event.target.value) router.push("/learn/" + event.target.value); }}>
      <option value="" disabled>Chuyển đến bất kỳ bài nào…</option>
      {course.lessons.map(lesson => <option value={lesson.id} key={lesson.id}>Bài {lesson.id} · {lesson.vi || lesson.title}</option>)}
    </select>
    <Link href="/learn">Xem tất cả bài</Link>
  </nav>;
}
