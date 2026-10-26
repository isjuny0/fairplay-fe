import { koreanDateTime } from "../lib/koreanTime.js";
import { validateAnnouncement } from "../lib/spaceAnnouncements.js";
import { MockError } from "./planned.js";

export function previewSpaceAnnouncements(
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
      createdAt: "2026-10-21T14:00:00",
      updatedAt: "2026-10-21T14:00:00",
    },
  ];
  const announcements = state.spaceAnnouncements;
  const hasId = parts.length === 5;
  const id = Number(parts[4]);
  if (parts.length > 5 || (hasId && (!Number.isSafeInteger(id) || id <= 0)))
    throw new MockError("INVALID_REQUEST", "공지 ID를 확인해 주세요.", 400);
  const existing = hasId ? announcements.find((item) => item.id === id) : null;
  if (hasId && !existing)
    throw new MockError(
      "ANNOUNCEMENT_NOT_FOUND",
      "공지사항이 삭제되었거나 존재하지 않습니다.",
      404,
    );
  if (existing && existing.spaceId !== spaceId)
    throw new MockError("FORBIDDEN", "이 스페이스의 공지가 아닙니다.", 403);
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
    return announcements
      .filter((item) => item.spaceId === spaceId)
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id - a.id,
      )
      .slice(page * size, (page + 1) * size);
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
    createdAt: input.updatedAt,
  };
  state.nextAnnouncementId = announcement.id + 1;
  state.spaceAnnouncements.push(announcement);
  return announcement;
}
