// Mark the report's skill gaps inside the job description they came from, in
// the same { segments, notes } shape MarkupSheet renders for the landing demo.

const STOP = new Set([
  "and", "the", "with", "for", "from", "into", "using", "based", "skills", "skill",
  "experience", "knowledge", "understanding", "advanced", "basic", "practical",
  "hands", "strong", "deep", "concepts", "fundamentals", "best", "practices", "tools",
]);

const ADVICE = {
  high: "Your biggest gap here. Expect at least one direct question on it, so prep it first.",
  medium: "Partly covered. Have one concrete example ready, even a small one.",
  low: "Minor. Know the basics well enough to explain how you'd learn the rest.",
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (s) => new RegExp(`(?<![\\w])${escape(s)}(?![\\w])`, "i");

// Candidate search terms for a gap, most specific first: the full phrase, the
// phrase without any "(...)" aside, then its meaningful words, longest first.
const termsFor = (skill) => {
  const full = skill.trim();
  const bare = full.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const words = bare
    .split(/[\s,/&+]+/)
    .map((w) => w.replace(/^[^\w]+|[^\w#+.]+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  return [...new Set([full, bare, ...words])].filter(Boolean);
};

// Which plan day, if any, mentions this gap.
export const planDayFor = (skill, plan = []) => {
  const terms = termsFor(skill);
  const day = plan.find((d) => {
    const haystack = [d.focus, ...(d.tasks || [])].join(" ");
    return terms.some((t) => wordRe(t).test(haystack));
  });
  return day?.day ?? null;
};

export function gapMarkup(text = "", gaps = [], plan = []) {
  const taken = [];
  const overlaps = (start, end) => taken.some((t) => start < t.end && end > t.start);

  const placed = [];
  const unmatched = [];

  gaps.forEach((gap, i) => {
    const severity = ["high", "medium", "low"].includes(gap.severity) ? gap.severity : "medium";
    const day = planDayFor(gap.skill, plan);
    const note = {
      key: `gap-${i}`,
      n: null,
      kind: `gap-${severity}`,
      label: `${gap.skill} · ${severity}`,
      text: ADVICE[severity] + (day ? ` Day ${day} of your plan covers it.` : ""),
      skill: gap.skill,
      severity,
      day,
    };

    let hit = null;
    for (const term of termsFor(gap.skill)) {
      const m = wordRe(term).exec(text);
      if (m && !overlaps(m.index, m.index + m[0].length)) {
        hit = { start: m.index, end: m.index + m[0].length };
        break;
      }
    }

    if (hit) {
      taken.push(hit);
      placed.push({ ...hit, note });
    } else {
      unmatched.push(note);
    }
  });

  placed.sort((a, b) => a.start - b.start);

  const segments = [];
  let pos = 0;
  placed.forEach((p, order) => {
    p.note.n = order + 1;
    if (p.start > pos) segments.push(text.slice(pos, p.start));
    segments.push({
      text: text.slice(p.start, p.end),
      kind: p.note.kind,
      key: p.note.key,
      n: p.note.n,
      first: true,
      order,
    });
    pos = p.end;
  });
  if (pos < text.length) segments.push(text.slice(pos));

  return { segments, notes: placed.map((p) => p.note), unmatched };
}
