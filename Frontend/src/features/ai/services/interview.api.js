import api from "../../../lib/api";

/**
 * Generate an interview report.
 * @param {{ resume: File|null, selfDescription: string, jobDescription: string }} payload
 */
export async function generateReport({ resume, selfDescription, jobDescription }) {
  const formData = new FormData();
  if (resume) formData.append("resume", resume);
  if (selfDescription) formData.append("selfDescription", selfDescription);
  formData.append("jobDescription", jobDescription);

  const response = await api.post("/api/interview", formData);
  return response.data;
}

/** Fetch summaries of the logged-in user's past interview reports, newest first. */
export async function getMyReports() {
  const response = await api.get("/api/interview");
  return response.data;
}

/** Save the ticked plan tasks ("dayIndex-taskIndex" ids) for a report. */
export async function saveProgress(id, completedTasks) {
  const response = await api.patch(`/api/interview/${encodeURIComponent(id)}/progress`, { completedTasks });
  return response.data;
}

/** Fetch one full report by id. */
export async function getReport(id) {
  const response = await api.get(`/api/interview/${encodeURIComponent(id)}`);
  return response.data;
}
