// Client-side "markup" of a job description for the landing page demo.
// This is intentionally simple keyword matching: it runs instantly, needs no
// account, and costs nothing. The real report (AI + resume) reads context.
//
// kind:
//   skill  -> highlighted, note is a likely technical question
//   people -> red underline, note is a likely behavioral question
//   signal -> red circle, note translates recruiter-speak into what it means

const B = "(?<![\\w])"; // left boundary that also works before "." or "+"
const E = "(?![\\w])";

const term = (source) => new RegExp(`${B}(?:${source})${E}`, "gi");

const RULES = [
  // --- frontend
  { id: "react", kind: "skill", re: term("react(?:\\.js|js)?"), note: "Walk me through when you'd lift state up vs. reach for a store or context." },
  { id: "next", kind: "skill", re: term("next\\.?js"), note: "When would you render on the server instead of the client, and what does it cost you?" },
  { id: "typescript", kind: "skill", re: term("typescript|ts"), note: "Show me a type you wrote that caught a real bug before it shipped." },
  { id: "javascript", kind: "skill", re: term("javascript|es6\\+?"), note: "Explain the event loop using a bug you've actually hit." },
  { id: "vue", kind: "skill", re: term("vue(?:\\.js)?"), note: "How does Vue's reactivity decide what to re-render?" },
  { id: "angular", kind: "skill", re: term("angular"), note: "How do you keep change detection from becoming the bottleneck?" },
  { id: "css", kind: "skill", re: term("css|tailwind(?:css)?|sass|scss"), note: "How do you keep a stylesheet from turning into an append-only file?" },
  { id: "redux", kind: "skill", re: term("redux|zustand"), note: "What belongs in the global store, and what definitely doesn't?" },
  { id: "a11y", kind: "skill", re: term("accessibility|accessible|a11y|wcag"), note: "How would you make a custom dropdown usable with only a keyboard?" },
  { id: "perf", kind: "skill", re: term("performance|core web vitals|lighthouse"), note: "A page got slow after a release. What do you check first, in order?" },
  { id: "design-systems", kind: "skill", re: term("design systems?|component librar(?:y|ies)"), note: "How do you change a shared component without breaking ten teams?" },
  { id: "figma", kind: "skill", re: term("figma"), note: "Tell me about a time the design didn't survive contact with real data." },

  // --- backend
  { id: "node", kind: "skill", re: term("node(?:\\.js|js)?"), note: "What happens to your Node server when one request does heavy CPU work?" },
  { id: "express", kind: "skill", re: term("express(?:\\.js)?"), note: "How do you structure error handling across Express middleware?" },
  { id: "rest", kind: "skill", re: term("rest(?:ful)? apis?|restful|apis?"), note: "Design the endpoints for this feature. How do you version them?" },
  { id: "graphql", kind: "skill", re: term("graphql"), note: "How do you stop one GraphQL query from taking down the database?" },
  { id: "python", kind: "skill", re: term("python"), note: "Where has Python's dynamic typing bitten you, and what did you change?" },
  { id: "java", kind: "skill", re: term("java(?!script)"), note: "How do you track down a memory leak in a long-running JVM service?" },
  { id: "go", kind: "skill", re: term("golang|go(?= ?(?:,|and|or|\\/)| services?)"), note: "When do goroutines make things worse rather than faster?" },
  { id: "microservices", kind: "skill", re: term("micro-?services?|distributed systems?"), note: "When would you argue against splitting a service?" },
  { id: "system-design", kind: "skill", re: term("system design|scalab(?:le|ility)|high[- ]traffic"), note: "Sketch this product's architecture at 10x today's traffic." },
  { id: "security", kind: "skill", re: term("security|auth(?:entication|orization)?|oauth|jwt"), note: "Where do you store a session token in the browser, and why there?" },
  { id: "testing", kind: "skill", re: term("testing|tests|jest|cypress|playwright|tdd"), note: "What do you deliberately not test, and how do you defend that?" },

  // --- data & infra
  { id: "sql", kind: "skill", re: term("sql|postgres(?:ql)?|mysql"), note: "Here's a slow query. Talk me through reading its plan." },
  { id: "mongo", kind: "skill", re: term("mongo(?:db)?"), note: "When would you embed a document vs. reference it?" },
  { id: "redis", kind: "skill", re: term("redis|caching|cache"), note: "How do you invalidate a cache without serving stale data?" },
  { id: "kafka", kind: "skill", re: term("kafka|message queues?|rabbitmq"), note: "A consumer falls an hour behind. What do you do?" },
  { id: "docker", kind: "skill", re: term("docker|containers?"), note: "Why is this image 2GB, and how would you get it smaller?" },
  { id: "k8s", kind: "skill", re: term("kubernetes|k8s"), note: "A pod keeps restarting. Walk me through finding out why." },
  { id: "cloud", kind: "skill", re: term("aws|gcp|azure|cloud"), note: "Which managed service would you not use here, and why?" },
  { id: "cicd", kind: "skill", re: term("ci\\/cd|continuous (?:integration|delivery|deployment)|github actions"), note: "What would make you block a deploy that has passing tests?" },
  { id: "git", kind: "skill", re: term("git"), note: "Tell me about a merge or rebase that went badly, and how you got out." },
  { id: "observability", kind: "skill", re: term("monitoring|observability|logging|metrics"), note: "Which three alerts would you set up on day one?" },

  // --- data / analytics / ml
  { id: "pandas", kind: "skill", re: term("pandas|numpy|jupyter"), note: "Your dataframe doesn't fit in memory. What now?" },
  { id: "viz", kind: "skill", re: term("tableau|power ?bi|looker|dashboards?"), note: "Show me a dashboard you built that someone actually changed a decision from." },
  { id: "excel", kind: "skill", re: term("excel|spreadsheets?"), note: "How do you make sure nobody silently breaks your spreadsheet model?" },
  { id: "stats", kind: "skill", re: term("statistics|statistical|a\\/b tests?|a\\/b testing|experiments?"), note: "An A/B test shows a 2% lift. Do you ship it? What else do you check?" },
  { id: "etl", kind: "skill", re: term("etl|data pipelines?|airflow|dbt|spark"), note: "A pipeline silently dropped rows last week. How would you have caught it?" },
  { id: "ml", kind: "skill", re: term("machine learning|ml|llms?|genai|ai"), note: "How would you know your model got worse after launch?" },
  { id: "metrics", kind: "skill", re: term("kpis?|okrs?|north star"), note: "Pick one metric for this product and argue why it can't be gamed." },
  { id: "roadmap", kind: "skill", re: term("roadmaps?|prioriti[sz](?:e|ation|ing)"), note: "You have three urgent asks and room for one. How do you choose and say no?" },
  { id: "research", kind: "skill", re: term("user research|customer interviews|discovery"), note: "Tell me about research that made you kill a feature you liked." },
  { id: "agile", kind: "skill", re: term("agile|scrum|kanban|sprints?"), note: "What's one agile ritual you'd drop, and what would you replace it with?" },

  // --- people
  { id: "collab", kind: "people", re: term("collaborat(?:e|ion|ive|ing)|work closely"), note: "Tell me about working with someone you disagreed with. How did it end?" },
  { id: "xfn", kind: "people", re: term("cross-functional(?:ly)?"), note: "Describe a project where engineering, design and product wanted different things." },
  { id: "stakeholders", kind: "people", re: term("stakeholders?"), note: "Tell me about delivering bad news to a stakeholder." },
  { id: "communication", kind: "people", re: term("communicat(?:e|ion|or)|written and verbal"), note: "Explain your last project to me as if I'm a non-technical buyer." },
  { id: "mentor", kind: "people", re: term("mentor(?:ing|ship)?|coach(?:ing)?"), note: "Tell me about someone you helped get better. What did you actually do?" },
  { id: "lead", kind: "people", re: term("leadership|lead(?:ing)? (?:a |the )?(?:team|project|initiative)s?"), note: "Tell me about a time you led without having authority." },
  { id: "ownership", kind: "people", re: term("ownership|own(?:ing)? (?:features?|projects?|outcomes?)|take ownership"), note: "Tell me about something that broke on your watch. What did you do next?" },
  { id: "problem", kind: "people", re: term("problem[- ]solv(?:ing|er)|analytical"), note: "Walk me through the hardest bug you've solved, step by step." },
  { id: "customers", kind: "people", re: term("customer[- ]facing|customers?|end users?"), note: "Tell me about a time a user's feedback changed what you built." },
  { id: "feedback", kind: "people", re: term("feedback|code reviews?"), note: "What's the most useful piece of critical feedback you've received?" },

  // --- reading between the lines
  { id: "years", kind: "signal", re: term("\\d+\\+?\\s*(?:-|to)?\\s*\\d*\\+?\\s*years?"), note: "A filter, not a law. Have one project ready that shows that level of judgment." },
  { id: "fast", kind: "signal", re: term("fast[- ]paced|move fast|rapidly changing"), note: "Priorities shift weekly. Expect: 'Tell me about a time plans changed mid-sprint.'" },
  { id: "startup", kind: "signal", re: term("start-?up|early[- ]stage|seed|series [a-c]"), note: "Small team. They'll test if you can work without a spec." },
  { id: "ambiguity", kind: "signal", re: term("ambigu(?:ity|ous)|self[- ]starter|autonom(?:y|ous(?:ly)?)|independently"), note: "No one will hand you tickets. Bring a story where you defined the problem yourself." },
  { id: "hats", kind: "signal", re: term("wear (?:many|multiple) hats|generalist|full[- ]stack"), note: "Expect questions outside your lane. Pick your weakest area and prep one solid answer." },
  { id: "oncall", kind: "signal", re: term("on-?call|pager(?:duty)?|incident"), note: "They'll ask about an outage. Have a calm, specific postmortem story." },
  { id: "endtoend", kind: "signal", re: term("end[- ]to[- ]end|from (?:idea|concept) to (?:production|launch)"), note: "They want shipping, not tasks. Talk in outcomes: what changed after you shipped?" },
  { id: "nice", kind: "signal", re: term("nice[- ]to[- ]have|bonus(?: points)?|preferred"), note: "Not required. Don't apologise for missing these, just show you can learn them." },
  { id: "passion", kind: "signal", re: term("passion(?:ate)?|love (?:for|of)|obsess(?:ed|ion)"), note: "They'll ask what you build or read outside work. Have a real answer." },
];

// How many notes of each kind earn a numbered spot in the margin. Everything
// else is still marked, and shows its note on hover instead.
const MARGIN_BUDGET = { skill: 4, people: 2, signal: 2 };

/**
 * Mark up a block of text.
 * Returns segments (plain strings and marks) plus one note per distinct rule.
 * Notes that fit the margin budget are numbered in reading order like
 * footnotes; the rest have n = null.
 */
export function markup(text) {
  const hits = [];

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      if (!m[0].trim()) {
        rule.re.lastIndex++;
        continue;
      }
      hits.push({ start: m.index, end: m.index + m[0].length, rule });
    }
  }

  // earliest first, then longest, then drop anything overlapping a kept hit
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start >= cursor) {
      kept.push(hit);
      cursor = hit.end;
    }
  }

  const notes = [];
  const noteByRule = new Map();
  kept.forEach((hit) => {
    if (noteByRule.has(hit.rule.id)) return;
    const note = { key: hit.rule.id, n: null, kind: hit.rule.kind, text: hit.rule.note };
    noteByRule.set(hit.rule.id, note);
    notes.push(note);
  });

  const used = { skill: 0, people: 0, signal: 0 };
  let numbered = 0;
  notes.forEach((note) => {
    if (used[note.kind] < MARGIN_BUDGET[note.kind]) {
      used[note.kind] += 1;
      note.n = ++numbered;
    }
  });

  const segments = [];
  const seen = new Set();
  let pos = 0;
  kept.forEach((hit, order) => {
    if (hit.start > pos) segments.push(text.slice(pos, hit.start));
    const note = noteByRule.get(hit.rule.id);
    const first = !seen.has(note.key);
    seen.add(note.key);
    segments.push({ text: text.slice(hit.start, hit.end), kind: note.kind, key: note.key, n: note.n, first, order });
    pos = hit.end;
  });

  if (pos < text.length) segments.push(text.slice(pos));

  const tally = { skill: 0, people: 0, signal: 0 };
  notes.forEach((note) => {
    tally[note.kind] += 1;
  });

  return { segments, notes, tally };
}
