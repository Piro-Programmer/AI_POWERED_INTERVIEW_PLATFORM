import api from "../../lib/api";

/** Site totals, last-7-day counts and today's AI usage. */
export async function getAdminStats() {
  const response = await api.get("/api/admin/stats");
  return response.data;
}

/** One page of users, newest first: { users, page, pageSize, total, hasMore }. */
export async function listUsers({ page = 1, q } = {}) {
  const response = await api.get("/api/admin/users", { params: { page, q: q || undefined } });
  return response.data;
}

/** Delete a user and all their data (recorded in the audit log). */
export async function deleteUser(id) {
  const response = await api.delete(`/api/admin/users/${encodeURIComponent(id)}`);
  return response.data;
}

/** The latest admin actions. */
export async function getAuditLog() {
  const response = await api.get("/api/admin/audit");
  return response.data;
}
