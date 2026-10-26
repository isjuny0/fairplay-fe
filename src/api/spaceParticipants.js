import { apiRequest } from "./client.js";

const collection = (spaceId) =>
  `/api/spaces/${spaceId}/manager-dashboard/members`;

export const listSpaceParticipants = async (spaceId) => {
  const result = await apiRequest(collection(spaceId));
  if (!Array.isArray(result))
    throw new Error("참여자 목록 응답 형식을 확인해 주세요.");
  return result;
};
export const removeSpaceParticipant = (spaceId, userId) =>
  apiRequest(`${collection(spaceId)}/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
