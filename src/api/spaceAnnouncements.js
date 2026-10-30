import { apiRequest } from "./client.js";

const collection = (spaceId) => `/api/spaces/${spaceId}/announcements`;
const detail = (spaceId, announcementId) =>
  `${collection(spaceId)}/${announcementId}`;

export const listSpaceAnnouncements = (spaceId, page = 0, size = 20) =>
  apiRequest(`${collection(spaceId)}?${new URLSearchParams({ page, size })}`);
export const getSpaceAnnouncement = (spaceId, announcementId) =>
  apiRequest(detail(spaceId, announcementId));
export const createSpaceAnnouncement = (spaceId, input) =>
  apiRequest(collection(spaceId), { method: "POST", body: input });
export const updateSpaceAnnouncement = (spaceId, announcementId, input) =>
  apiRequest(detail(spaceId, announcementId), { method: "PATCH", body: input });
export const deleteSpaceAnnouncement = (
  spaceId,
  announcementId,
  expectedVersion,
) =>
  apiRequest(
    `${detail(spaceId, announcementId)}?${new URLSearchParams({ expectedVersion })}`,
    { method: "DELETE" },
  );

export const uploadSpaceAnnouncementAttachment = (
  spaceId,
  announcementId,
  expectedVersion,
  file,
) => {
  const body = new FormData();
  body.append(
    "metadata",
    new Blob([JSON.stringify({ expectedVersion })], {
      type: "application/json",
    }),
  );
  body.append("file", file);
  return apiRequest(`${detail(spaceId, announcementId)}/attachments`, {
    method: "POST",
    body,
  });
};

export const downloadSpaceAnnouncementAttachment = (
  spaceId,
  announcementId,
  attachmentId,
) =>
  apiRequest(
    `${detail(spaceId, announcementId)}/attachments/${attachmentId}/file`,
    { responseType: "blob" },
  );

export const deleteSpaceAnnouncementAttachment = (
  spaceId,
  announcementId,
  attachmentId,
  expectedVersion,
) =>
  apiRequest(
    `${detail(spaceId, announcementId)}/attachments/${attachmentId}?${new URLSearchParams({ expectedVersion })}`,
    { method: "DELETE" },
  );
