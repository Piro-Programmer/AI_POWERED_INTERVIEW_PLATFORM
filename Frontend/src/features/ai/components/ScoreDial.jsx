import { useEffect, useState } from "react";

const scoreLabel = (score) => {
  if (score >= 80) return "Strong match. Polish the details.";
  if (score >= 60) return "Good foundation, with gaps worth a weekend.";
  if (score >= 40) return "Real gaps. The plan below matters.";
  return "A stretch role. Prep the basics first.";
};

// Big serif score that counts up, with a pen loop that closes only as far as
// the score does: a 72 leaves a visible gap.
const ScoreDial = ({ score = 0 }) => {
  const target = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 1 : 1400;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <figure className="dial" aria-label={`Match score ${target} out of 100`}>
      <div className="dial__num" aria-hidden="true">
        {shown}
        <svg className="dial__ring" viewBox="0 0 220 140" preserveAspectRatio="none">
          <path
            className="dial__track"
            pathLength="1"
            d="M110 12 C 190 12, 212 52, 208 76 C 202 116, 150 132, 106 130 C 50 128, 12 108, 14 70 C 16 34, 60 12, 110 12"
          />
          <path
            className="dial__stroke"
            pathLength="1"
            style={{ "--gap": 1 - target / 100 }}
            d="M110 12 C 190 12, 212 52, 208 76 C 202 116, 150 132, 106 130 C 50 128, 12 108, 14 70 C 16 34, 60 12, 110 12"
          />
        </svg>
      </div>
      <figcaption>
        <span className="eyebrow">Match score / 100</span>
        <p>{scoreLabel(target)}</p>
      </figcaption>
    </figure>
  );
};

export default ScoreDial;
