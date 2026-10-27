import { apiRequest, ApiError } from "./client.js";

const collection = (teamId) => `/api/teams/${teamId}/meeting-minutes`;
const detail = (id) => `/api/meeting-minutes/${id}`;

export async function listMeetingMinutes(teamId, page = 0, size = 20) {
  const items = await apiRequest(
    `${collection(teamId)}?${new URLSearchParams({ page, size })}`,
  );
  if (!Array.isArray(items))
    throw new Error("회의록 목록 응답 형식을 확인해 주세요.");
  return items;
}
export const getMeetingMinute = (id) => apiRequest(detail(id));
export const createMeetingMinute = (teamId, input) =>
  apiRequest(collection(teamId), { method: "POST", body: input });
export const updateMeetingMinute = (id, input) =>
  apiRequest(detail(id), { method: "PATCH", body: input });
export const deleteMeetingMinute = (id, expectedVersion) =>
  apiRequest(`${detail(id)}?${new URLSearchParams({ expectedVersion })}`, {
    method: "DELETE",
  });

export function assertMeetingTeam(item, teamId) {
  if (item.teamId !== teamId)
    throw new ApiError(403, {
      code: "FORBIDDEN",
      message: "이 팀의 회의록이 아닙니다.",
    });
  return item;
}
