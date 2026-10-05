export function ProgressRing({
  value,
  size = 72,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 68 68" aria-hidden="true">
        <circle className="ring-track" cx="34" cy="34" r={radius} />
        <circle
          className="ring-value"
          cx="34"
          cy="34"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label">
        <strong>{value}%</strong>
        {label ? <span>{label}</span> : null}
      </div>
    </div>
  );
}
