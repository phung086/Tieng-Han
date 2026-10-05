const skills = ["Từ vựng", "Ngữ pháp", "Nghe", "Nói", "Đọc", "Viết"];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">한국어 학습 플랫폼</span>
        <h1>Học tiếng Hàn bám sát giáo trình.</h1>
        <p>
          Ôn theo từng bài, luyện đủ Nghe · Nói · Đọc · Viết và theo dõi tiến độ
          từ vựng, ngữ pháp theo đúng nội dung sách.
        </p>
        <div className="actions">
          <button>Bắt đầu học</button>
          <a href="#skills">Khám phá nội dung</a>
        </div>
      </section>

      <section id="skills" className="grid">
        {skills.map((skill) => (
          <article key={skill}>
            <span>01</span>
            <h2>{skill}</h2>
            <p>Quiz và bài luyện được liên kết trực tiếp với bài học trong giáo trình.</p>
          </article>
        ))}
      </section>
    </main>
  );
}
