type MascotSize = "sm" | "md" | "lg";

export function HaneulMascot({
  size = "md",
  label = "Gureumi - linh vật Haneul",
}: {
  size?: MascotSize;
  label?: string;
}) {
  return (
    <div className={"haneul-mascot mascot-" + size} role="img" aria-label={label}>
      <span className="mascot-star star-one">✦</span>
      <span className="mascot-star star-two">✦</span>
      <div className="mascot-cloud">
        <span className="mascot-puff puff-one" />
        <span className="mascot-puff puff-two" />
        <span className="mascot-puff puff-three" />
        <span className="mascot-face">
          <i className="mascot-eye left" />
          <i className="mascot-eye right" />
          <i className="mascot-mouth" />
          <i className="mascot-cheek left" />
          <i className="mascot-cheek right" />
        </span>
      </div>
      <span className="mascot-shadow" />
    </div>
  );
}
