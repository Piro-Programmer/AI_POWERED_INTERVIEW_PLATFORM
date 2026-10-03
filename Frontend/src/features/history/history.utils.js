// Plan ticks are stored per report by PrepPlan under "plan:<id>".
export const planDone = (id) => {
  try {
    const ticks = JSON.parse(localStorage.getItem(`plan:${id}`));
    return Array.isArray(ticks) ? ticks.length : 0;
  } catch {
    return 0;
  }
};

export const planStatus = (done, total) => {
  if (total > 0 && done >= total) return "done";
  if (done > 0) return "in-progress";
  return "not-started";
};

export const cleanTitle = (title = "") =>
  title.replace(/^Interview Report\s*-\s*/i, "").trim() || "Interview report";

export const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "";
};

export const firstLine = (text = "") =>
  text.split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
