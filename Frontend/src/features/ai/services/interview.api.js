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

/** Fetch the logged-in user's past interview reports. */
export async function getMyReports() {
  const response = await api.get("/api/interview");
  return response.data;
}
