import { koreanDateTime } from "../lib/koreanTime.js";
import { validateAnnouncement } from "../lib/spaceAnnouncements.js";
import { MockError } from "./planned.js";

export async function previewSpaceAnnouncements(
  context,
  state,
  parts,
  url,
  method,
  body,
) {
  const spaceId = Number(parts[2]);
  if (!Number.isSafeInteger(spaceId) || spaceId <= 0)
    throw new MockError("INVALID_REQUEST", "스페이스 ID를 확인해 주세요.", 400);
  const space =
    spaceId === context.space.id
      ? context.space
      : state.extraSpace?.id === spaceId
        ? state.extraSpace
        : null;
  if (!space)
    throw new MockError("SPACE_NOT_FOUND", "스페이스가 없습니다.", 404);
  if (!["MANAGER", "USER"].includes(space.myRole))
    throw new MockError(
      "FORBIDDEN",
      "스페이스 회원만 공지를 확인할 수 있습니다.",
      403,
    );
  if (method !== "GET" && space.myRole !== "MANAGER")
    throw new MockError(
      "FORBIDDEN",
      "스페이스 관리자만 공지를 관리할 수 있습니다.",
      403,
    );
  // Seed only once, including for already saved preview states. An empty array stays empty.
  state.spaceAnnouncements ??= [
    {
      id: 1,
      spaceId: context.space.id,
      authorId: "00000000-0000-4000-8000-000000000004",
      authorName: "정민수",
      title: "프로젝트 진행 및 공지 확인 안내",
      content:
        "프로젝트 공지는 이곳에서 확인해 주세요.\n팀별 작업과 제출 일정은 각 팀에서 관리합니다.",
      pinned: true,
      version: 0,
      attachments: [],
      createdAt: "2026-10-20T09:00:00",
      updatedAt: "2026-10-20T09:00:00",
    },
    {
      id: 2,
      spaceId: context.space.id,
      authorId: "00000000-0000-4000-8000-000000000004",
      authorName: "정민수",
      title: "팀별 진행 상황을 공유해 주세요",
      content: "다음 회의 전에 팀별 진행 상황과 확인할 내용을 정리해 주세요.",
      pinned: false,
      version: 0,
      attachments: [
        {
          id: 1,
          originalFilename: "팀별 진행 상황 안내.txt",
          contentType: "text/plain",
          sizeBytes: 84,
          createdAt: "2026-10-21T14:00:00",
        },
        {
          id: 2,
          originalFilename: "회의 준비 체크리스트.txt",
          contentType: "text/plain",
          sizeBytes: 72,
          createdAt: "2026-10-21T14:00:00",
        },
      ],
      createdAt: "2026-10-21T14:00:00",
      updatedAt: "2026-10-21T14:00:00",
    },
  ];
  const announcements = state.spaceAnnouncements;
  if ((state.spaceAnnouncementAttachmentFixtureVersion || 0) < 2) {
    const sample = announcements.find(
      (item) =>
        item.spaceId === context.space.id &&
        item.title === "팀별 진행 상황을 공유해 주세요",
    );
    if (sample) {
      sample.attachments ??= [];
      const existingAttachmentIds = announcements.flatMap((item) =>
        (item.attachments || []).map((attachment) => attachment.id),
      );
      let attachmentId = Math.max(0, ...existingAttachmentIds) + 1;
      const fixtureAttachments = [
        {
          originalFilename: "팀별 진행 상황 안내.txt",
          contentType: "text/plain",
          sizeBytes: 84,
        },
        {
          originalFilename: "회의 준비 체크리스트.txt",
          contentType: "text/plain",
          sizeBytes: 72,
        },
      ];
      for (const fixture of fixtureAttachments) {
        if (
          sample.attachments.some(
            (attachment) => attachment.originalFilename === fixture.originalFilename,
          )
        )
          continue;
        sample.attachments.push({
          id: attachmentId++,
          ...fixture,
          createdAt: sample.createdAt,
        });
      }
    }
    state.spaceAnnouncementAttachmentFixtureVersion = 2;
    const maxAttachmentId = Math.max(
      0,
      ...announcements.flatMap((item) =>
        (item.attachments || []).map((attachment) => attachment.id),
      ),
    );
    state.nextAnnouncementAttachmentId = Math.max(
      state.nextAnnouncementAttachmentId || 1,
      maxAttachmentId + 1,
    );
  }
  const hasId = parts.length >= 5;
  const id = Number(parts[4]);
  const attachmentRoute = parts[5] === "attachments";
  if ((parts.length > 5 && !attachmentRoute) || (hasId && (!Number.isSafeInteger(id) || id <= 0)))
    throw new MockError("INVALID_REQUEST", "공지 ID를 확인해 주세요.", 400);
  const existing = hasId ? announcements.find((item) => item.id === id) : null;
  if (existing) existing.attachments ??= [];
  if (hasId && !existing)
    throw new MockError(
      "ANNOUNCEMENT_NOT_FOUND",
      "공지사항이 삭제되었거나 존재하지 않습니다.",
      404,
    );
  if (existing && existing.spaceId !== spaceId)
    throw new MockError("FORBIDDEN", "이 스페이스의 공지가 아닙니다.", 403);
  if (attachmentRoute) {
    const attachmentId = Number(parts[6]);
    existing.attachments ??= [];
    if (method === "GET" && parts.length === 8 && parts[7] === "file") {
      const attachment = existing.attachments.find((item) => item.id === attachmentId);
      if (!attachment) throw new MockError("ANNOUNCEMENT_ATTACHMENT_NOT_FOUND", "첨부파일을 찾을 수 없습니다.", 404);
      return new Blob([`미리보기용 첨부파일: ${attachment.originalFilename}`], { type: attachment.contentType || "application/octet-stream" });
    }
    if (method === "POST" && parts.length === 6) {
      const metadataPart = body instanceof FormData ? body.get("metadata") : null;
      const file = body instanceof FormData ? body.get("file") : null;
      let metadata;
      try { metadata = JSON.parse(await metadataPart.text()); }
      catch { throw new MockError("INVALID_REQUEST", "첨부파일 요청 형식을 확인해 주세요.", 400); }
      if (!file || metadata?.expectedVersion !== existing.version)
        throw new MockError(metadata?.expectedVersion === existing.version ? "INVALID_REQUEST" : "ANNOUNCEMENT_VERSION_CONFLICT", "공지 버전 또는 첨부파일을 확인해 주세요.");
      if (existing.attachments.length >= 10)
        throw new MockError("ANNOUNCEMENT_ATTACHMENT_LIMIT_EXCEEDED", "공지 첨부파일은 최대 10개까지 등록할 수 있습니다.");
      const attachment = {
        id: state.nextAnnouncementAttachmentId || 1,
        originalFilename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        createdAt: koreanDateTime(),
      };
      state.nextAnnouncementAttachmentId = attachment.id + 1;
      existing.attachments.push(attachment);
      existing.version++;
      existing.updatedAt = koreanDateTime();
      return existing;
    }
    if (method === "DELETE" && parts.length === 7) {
      const expected = Number(url.searchParams.get("expectedVersion"));
      if (!Number.isSafeInteger(expected) || expected !== existing.version)
        throw new MockError("ANNOUNCEMENT_VERSION_CONFLICT", "다른 관리자가 공지를 변경했습니다. 최신 내용을 확인해 주세요.");
      const index = existing.attachments.findIndex((item) => item.id === attachmentId);
      if (index < 0) throw new MockError("ANNOUNCEMENT_ATTACHMENT_NOT_FOUND", "첨부파일을 찾을 수 없습니다.", 404);
      existing.attachments.splice(index, 1);
      existing.version++;
      existing.updatedAt = koreanDateTime();
      return null;
    }
    throw new MockError("NOT_FOUND", "지원하지 않는 첨부파일 API입니다.", 404);
  }
  if (method === "GET") {
    if (hasId) return existing;
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 20);
    if (
      !Number.isInteger(page) ||
      page < 0 ||
      page > 2147483647 ||
      !Number.isInteger(size) ||
      size < 1 ||
      size > 100
    )
      throw new MockError(
        "INVALID_REQUEST",
        "공지 목록 페이지 범위를 확인해 주세요.",
        400,
      );
    const all = announcements
      .filter((item) => item.spaceId === spaceId)
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id - a.id,
      )
    return {
      items: all.slice(page * size, (page + 1) * size),
      totalCount: all.length,
    };
  }
  if (
    (hasId && !["PATCH", "DELETE"].includes(method)) ||
    (!hasId && method !== "POST")
  )
    throw new MockError("NOT_FOUND", "지원하지 않는 API입니다.", 404);
  if (hasId) {
    const expected =
      method === "DELETE"
        ? url.searchParams.get("expectedVersion")
        : body?.expectedVersion;
    if (
      expected == null ||
      expected === "" ||
      (method === "PATCH" && typeof expected !== "number") ||
      !Number.isSafeInteger(Number(expected)) ||
      Number(expected) < 0
    )
      throw new MockError(
        "INVALID_REQUEST",
        "현재 공지 버전이 필요합니다.",
        400,
      );
    if (Number(expected) !== existing.version)
      throw new MockError(
        "ANNOUNCEMENT_VERSION_CONFLICT",
        "다른 관리자가 공지를 변경했습니다. 최신 내용을 확인해 주세요.",
      );
  }
  if (method === "DELETE") {
    state.spaceAnnouncements = announcements.filter((item) => item.id !== id);
    return null;
  }
  const validation = validateAnnouncement(body);
  if (validation)
    throw new MockError("INVALID_REQUEST", validation.message, 400);
  if (
    (method === "PATCH" || body?.pinned !== undefined) &&
    typeof body?.pinned !== "boolean"
  )
    throw new MockError(
      "INVALID_REQUEST",
      "상단 고정 여부를 확인해 주세요.",
      400,
    );
  const input = {
    title: body.title.trim(),
    content: body.content.trim(),
    pinned: body.pinned ?? false,
    updatedAt: koreanDateTime(),
  };
  if (method === "PATCH") {
    Object.assign(existing, input, { version: existing.version + 1 });
    return existing;
  }
  const announcement = {
    ...input,
    id: Math.max(
      state.nextAnnouncementId || 1,
      ...announcements.map((item) => item.id + 1),
    ),
    spaceId,
    authorId: context.user.id,
    authorName: context.user.name,
    version: 0,
    attachments: [],
    createdAt: input.updatedAt,
  };
  state.nextAnnouncementId = announcement.id + 1;
  state.spaceAnnouncements.push(announcement);
  return announcement;
}
