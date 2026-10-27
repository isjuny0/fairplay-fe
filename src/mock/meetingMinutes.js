import { koreanDateTime } from "../lib/koreanTime.js";
import { validateMeetingMinute } from "../lib/meetingMinutes.js";
import { MockError } from "./planned.js";

const fail = (code, message, status = 409) => {
  throw new MockError(code, message, status);
};
const positiveId = (value) =>
  /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));

export function previewMeetingMinutes(
  context,
  state,
  parts,
  url,
  method,
  body,
) {
  // Seed once; an empty collection after deletion remains empty, including after reload.
  state.meetingMinutes ??= Object.values(state.teams)
    .filter((entry) => entry.members.length)
    .map((entry) => ({
      id: entry.team.id,
      teamId: entry.team.id,
      title: "주간 진행 상황 공유",
      meetingAt: "2026-10-27T19:00:00",
      authorId: entry.members[0].userId,
      authorName: entry.members[0].name,
      attendees: entry.members.map(({ userId, name }) => ({ userId, name })),
      agenda: "- 작업 진행 상황 공유\n- 다음 일정 확인",
      content: "각 담당 작업의 진행 상황과 확인할 내용을 공유했습니다.",
      decisions: "- [ ] 다음 회의 전까지 보완안을 정리합니다.",
      version: 0,
      createdAt: "2026-10-27T09:00:00",
      updatedAt: "2026-10-27T09:00:00",
    }));
  const byTeam = parts[1] === "teams";
  if (!positiveId(parts[2]) || parts.length !== (byTeam ? 4 : 3))
    fail("INVALID_REQUEST", "회의록 경로를 확인해 주세요.", 400);
  const existing = byTeam
    ? null
    : state.meetingMinutes.find((item) => item.id === Number(parts[2]));
  if (!byTeam && !existing)
    fail(
      "MEETING_MINUTE_NOT_FOUND",
      "회의록이 삭제되었거나 존재하지 않습니다.",
      404,
    );
  const teamId = byTeam ? Number(parts[2]) : existing.teamId;
  const entry = state.teams[teamId];
  if (!entry)
    fail(
      byTeam ? "TEAM_NOT_FOUND" : "MEETING_MINUTE_NOT_FOUND",
      "대상을 찾을 수 없습니다.",
      404,
    );
  const removed = state.removedSpaceParticipants?.some(
    (item) =>
      item.spaceId === entry.team.spaceId && item.userId === context.user.id,
  );
  if (
    removed ||
    !entry.members.some((member) => member.userId === context.user.id)
  )
    fail("FORBIDDEN", "현재 승인된 팀원만 회의록을 이용할 수 있습니다.", 403);
  const names = new Map(
    Object.values(state.teams).flatMap((team) =>
      team.members.map((member) => [member.userId, member.name]),
    ),
  );
  const response = (item) => ({
    ...item,
    authorName: names.get(item.authorId) || item.authorName,
    attendees: item.attendees
      .map((person) => ({
        ...person,
        name: names.get(person.userId) || person.name,
      }))
      .sort((a, b) => a.userId.localeCompare(b.userId)),
  });
  if (method === "GET") {
    if (!byTeam) return response(existing);
    const pageValue = url.searchParams.get("page") ?? "0",
      sizeValue = url.searchParams.get("size") ?? "20";
    const page = Number(pageValue),
      size = Number(sizeValue);
    if (
      !/^\d+$/.test(pageValue) ||
      !/^\d+$/.test(sizeValue) ||
      !Number.isInteger(page) ||
      page > 2147483647 ||
      size < 1 ||
      size > 100
    )
      fail("INVALID_REQUEST", "목록 페이지 범위를 확인해 주세요.", 400);
    return state.meetingMinutes
      .filter((item) => item.teamId === teamId)
      .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt) || b.id - a.id)
      .slice(page * size, (page + 1) * size)
      .map((item) => {
        const { agenda, content, decisions, attendees, ...summary } =
          response(item);
        return { ...summary, attendeeCount: attendees.length };
      });
  }
  if (
    (byTeam && method !== "POST") ||
    (!byTeam && !["PATCH", "DELETE"].includes(method))
  )
    fail("NOT_FOUND", "지원하지 않는 API입니다.", 404);
  if (
    entry.team.workFrozen ||
    (state.deletion?.teamId === teamId && state.deletion.workFrozen)
  )
    fail(
      "TEAM_DELETION_IN_PROGRESS",
      "팀 삭제 동의 중에는 회의록을 변경할 수 없습니다.",
    );
  if (!byTeam) {
    const expected =
      method === "DELETE"
        ? url.searchParams.get("expectedVersion")
        : body?.expectedVersion;
    if (
      expected == null ||
      expected === "" ||
      (method === "DELETE" && !/^\d+$/.test(expected)) ||
      (method === "PATCH" && typeof expected !== "number") ||
      !Number.isSafeInteger(Number(expected)) ||
      Number(expected) < 0
    )
      fail("INVALID_REQUEST", "현재 회의록 버전이 필요합니다.", 400);
    if (Number(expected) !== existing.version)
      fail(
        "MEETING_MINUTE_VERSION_CONFLICT",
        "다른 팀원이 회의록을 변경했습니다. 최신 내용을 확인해 주세요.",
      );
  }
  if (method === "DELETE") {
    state.meetingMinutes = state.meetingMinutes.filter(
      (item) => item.id !== existing.id,
    );
    return null;
  }
  const errors = validateMeetingMinute(body, !byTeam);
  if (Object.keys(errors).length)
    fail("INVALID_REQUEST", Object.values(errors)[0], 400);
  if (
    body.attendeeIds?.some(
      (id) =>
        !existing?.attendees.some((person) => person.userId === id) &&
        !entry.members.some((person) => person.userId === id),
    )
  )
    fail("INVALID_REQUEST", "새 참석자는 현재 승인된 팀원이어야 합니다.", 400);
  const input = Object.fromEntries(
    ["title", "meetingAt", "agenda", "content", "decisions"]
      .filter((key) => Object.hasOwn(body, key))
      .map((key) => [key, key === "title" ? body[key].trim() : body[key]]),
  );
  const attendees = body.attendeeIds?.map((id) => ({
    userId: id,
    name:
      names.get(id) ||
      existing?.attendees.find((person) => person.userId === id)?.name,
  }));
  const timestamp = koreanDateTime();
  if (existing) {
    Object.assign(existing, input, {
      ...(attendees ? { attendees } : {}),
      version: existing.version + 1,
      updatedAt: timestamp,
    });
    return response(existing);
  }
  const item = {
    agenda: "",
    content: "",
    decisions: "",
    ...input,
    id: Math.max(
      state.nextMeetingMinuteId || 1,
      ...state.meetingMinutes.map((record) => record.id + 1),
    ),
    teamId,
    authorId: context.user.id,
    authorName: context.user.name,
    attendees: attendees || [],
    version: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.nextMeetingMinuteId = item.id + 1;
  state.meetingMinutes.push(item);
  return response(item);
}
