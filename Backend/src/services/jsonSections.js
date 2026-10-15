/**
 * The top-level fields of a JSON object that are already complete in a
 * partial (still streaming) text, e.g. while the AI is writing
 * '{"matchScore": 72, "technicalQuestions": [{"question": "...", ...}, {"qu'
 * this returns { matchScore: 72 }: the questions aren't finished yet.
 *
 * It only reads; it never guesses at an unfinished value. Anything it can't
 * parse is skipped, and the full answer is still validated at the end.
 */
export function completedSections(text) {
  const sections = {};
  let i = text.indexOf("{");
  if (i === -1) return sections;
  i += 1;

  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i])) i += 1;
  };

  // index just past the string that starts at text[start] === '"', or -1 if unfinished
  const endOfString = (start) => {
    for (let j = start + 1; j < text.length; j++) {
      if (text[j] === "\\") j += 1;
      else if (text[j] === '"') return j + 1;
    }
    return -1;
  };

  // index just past the value that starts at `start`, or -1 if unfinished
  const endOfValue = (start) => {
    if (text[start] === '"') return endOfString(start);
    if (text[start] === "{" || text[start] === "[") {
      let depth = 0;
      for (let j = start; j < text.length; j++) {
        const ch = text[j];
        if (ch === '"') {
          const end = endOfString(j);
          if (end === -1) return -1;
          j = end - 1;
        } else if (ch === "{" || ch === "[") depth += 1;
        else if (ch === "}" || ch === "]") {
          depth -= 1;
          if (depth === 0) return j + 1;
        }
      }
      return -1;
    }
    // number, true, false, null: complete once something follows it
    const match = /^[^,}\]\s]+/.exec(text.slice(start));
    if (!match) return -1;
    const end = start + match[0].length;
    return end < text.length ? end : -1;
  };

  while (i < text.length) {
    skipSpace();
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] !== '"') break; // "}" or unfinished

    const keyEnd = endOfString(i);
    if (keyEnd === -1) break;
    let key;
    try {
      key = JSON.parse(text.slice(i, keyEnd));
    } catch {
      break;
    }

    i = keyEnd;
    skipSpace();
    if (text[i] !== ":") break;
    i += 1;
    skipSpace();

    const valueEnd = endOfValue(i);
    if (valueEnd === -1) break;
    try {
      sections[key] = JSON.parse(text.slice(i, valueEnd));
    } catch {
      // not valid JSON: leave it out, the final validation will catch it
    }
    i = valueEnd;
  }

  return sections;
}
