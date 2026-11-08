import { ApiError, apiRequest } from "./client.js";
export const listDeliverables = (
  teamId,
  {
    taskId,
    page = 0,
    size = 20,
    q,
    type,
    authorId,
    unlinkedOnly,
    sort,
  } = {},
) => {
  const query = new URLSearchParams({ page, size });
  if (taskId != null) query.set("taskId", taskId);
  for (const [key, value] of Object.entries({
    q,
    type,
    authorId,
    sort,
  })) {
    if (value) query.set(key, value);
  }
  if (unlinkedOnly) query.set("unlinkedOnly", "true");
  return apiRequest(`/api/teams/${teamId}/deliverables?${query}`);
};
export async function findTaskDeliverable(teamId, taskId, deliverableId) {
  const size = 100;
  for (let page = 0; ; page++) {
    const materials = await listDeliverables(teamId, { taskId, page, size });
    const material = materials.find((item) => item.id === deliverableId);
    if (material) {
      if (material.teamId !== teamId || material.taskId !== taskId)
        throw new ApiError(502, { message: "자료 정보를 확인하지 못했습니다." });
      return material;
    }
    if (materials.length < size)
      throw new ApiError(404, { message: "자료가 삭제되었거나 연결이 변경되어 현재 작업에서 조회할 수 없습니다." });
  }
}
export const createDeliverable = (teamId, body) =>
  apiRequest(`/api/teams/${teamId}/deliverables`, { method: "POST", body });
export const uploadDeliverable = (teamId, input, file) => {
  const body = new FormData();
  body.append(
    "metadata",
    new Blob([JSON.stringify(input)], { type: "application/json" }),
  );
  body.append("file", file);
  return apiRequest(`/api/teams/${teamId}/deliverables/files`, {
    method: "POST",
    body,
  });
};
export const updateDeliverable = (id, metadata, file) => {
  if (!file)
    return apiRequest(`/api/deliverables/${id}`, {
      method: "PATCH",
      body: metadata,
    });
  const body = new FormData();
  body.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  body.append("file", file);
  return apiRequest(`/api/deliverables/${id}`, { method: "PATCH", body });
};
export const deleteDeliverable = (id, expectedVersion) =>
  apiRequest(`/api/deliverables/${id}?expectedVersion=${expectedVersion}`, {
    method: "DELETE",
  });
export const downloadDeliverable = (id) =>
  apiRequest(`/api/deliverables/${id}/file`, { responseType: "blob" });

export async function downloadRagSourceFile(teamId, reference) {
  const blob = await downloadDeliverable(reference.deliverableId);
  const size = 100;
  // Check the version after fetching the bytes so a concurrent replacement cannot be served as the cited file.
  for (let page = 0; ; page++) {
    const materials = await listDeliverables(teamId, { q: reference.title, type: "FILE", page, size });
    const material = materials.find((item) => item.id === reference.deliverableId);
    if (material) {
      if (material.teamId === teamId && material.version === reference.deliverableVersion && material.file?.originalFilename) {
        return { blob, filename: material.file.originalFilename };
      }
      break;
    }
    if (materials.length < size) break;
  }
  throw new ApiError(409, { code: "RAG_SOURCE_CHANGED" });
}
