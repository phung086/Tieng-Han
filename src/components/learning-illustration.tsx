"use client";
import { useState } from "react";
import type { LearningIllustration, LessonContent } from "@/data/content";
import { illustrationUrl, illustrationsFor } from "@/lib/learning-illustrations";
import { useContent } from "@/lib/content-store";
import styles from "./learning-illustration.module.css";

export function LearningFigure({ image, compact = false }: { image: LearningIllustration; compact?: boolean }) {
  const { course } = useContent();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  return <figure className={compact ? styles.compact : styles.figure}>
    {failed ? <div className={styles.failure}><p>Chưa tải được hình. Bạn vẫn có thể học nội dung bên dưới.</p><button type="button" onClick={() => { setFailed(false);setRetry(value=>value+1); }}>Tải lại hình</button></div> :
      /* eslint-disable-next-line @next/next/no-img-element -- Authenticated, authored crop of private source pixels. */
      <img key={image.id+retry} src={illustrationUrl(course.id,image)+"&retry="+retry} alt={compact ? "Hình gợi nhớ của mục từ" : image.alt} width={400} height={Math.max(1,Math.round(400*image.region[3]/image.region[2]))} loading="lazy" decoding="async" onError={()=>setFailed(true)} />}
    {!compact && image.caption ? <figcaption>{image.caption}</figcaption> : null}
    {!compact ? <details className={styles.source}><summary>Nguồn hình</summary><small>{image.fileName} · trang PDF {image.pageNumber} · {image.relation === "exact" ? "Ảnh theo chú thích của mục từ" : "Hình ngữ cảnh của mục học"}</small></details> : null}
  </figure>;
}

export function ItemIllustrations({ lesson, kind, itemId, exactOnly = false, compact = false }: { lesson: LessonContent; kind: LearningIllustration["kind"]; itemId: string; exactOnly?: boolean; compact?: boolean }) {
  return <>{illustrationsFor(lesson,kind,itemId,exactOnly).map(image=><LearningFigure key={image.id} image={image} compact={compact} />)}</>;
}
