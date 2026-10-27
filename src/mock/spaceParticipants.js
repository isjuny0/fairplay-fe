import { MockError } from "./planned.js";
import { previewUsers } from "./fixtures.js";
import { koreanDateTime } from "../lib/koreanTime.js";

const fail = (code, message, status = 409) => {
  throw new MockError(code, message, status);
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRemovedSpaceParticipant(
  context,
  state,
  spaceId = context.space.id,
) {
  return (state.removedSpaceParticipants || []).some(
    (item) => item.spaceId === spaceId && item.userId === context.user.id,
  );
}

export function previewSpaceParticipants(context, state, parts, method) {
  const spaceId = Number(parts[2]);
  if (!Number.isSafeInteger(spaceId) || spaceId <= 0)
    fail("INVALID_REQUEST", "스페이스 ID를 확인해 주세요.", 400);
  const space =
    spaceId === context.space.id
      ? context.space
      : state.extraSpace?.id === spaceId
        ? state.extraSpace
        : null;
  if (!space) fail("SPACE_NOT_FOUND", "스페이스가 없습니다.", 404);
  if (
    space.myRole !== "MANAGER" ||
    isRemovedSpaceParticipant(context, state, spaceId)
  )
    fail("FORBIDDEN", "스페이스 관리자만 참여자를 관리할 수 있습니다.", 403);
  const entries = Object.values(state.teams).filter(
    (entry) => entry.team.spaceId === spaceId,
  );
  state.spaceParticipantMemberships ||= [];
  state.removedSpaceParticipants ||= [];
  const candidates =
    spaceId === context.space.id
      ? [
          ...Object.values(previewUsers).map((user) => ({
            userId: user.id,
            name: user.name,
          })),
          ...entries.flatMap((entry) => entry.members),
          ...(state.applications || []).filter((item) =>
            entries.some((entry) => entry.team.id === item.teamId),
          ),
        ]
      : [{ userId: context.user.id, name: context.user.name }];
  for (const candidate of candidates) {
    if (
      !candidate.userId ||
      state.removedSpaceParticipants.some(
        (item) => item.spaceId === spaceId && item.userId === candidate.userId,
      )
    )
      continue;
    if (
      !state.spaceParticipantMemberships.some(
        (item) => item.spaceId === spaceId && item.userId === candidate.userId,
      )
    )
      state.spaceParticipantMemberships.push({
        spaceId,
        userId: candidate.userId,
        name: candidate.name,
        role:
          candidate.userId === previewUsers.manager.id ||
          spaceId !== context.space.id
            ? "MANAGER"
            : "USER",
        joinedAt: space.startAt || "2026-09-01T09:00:00",
      });
  }
  const approvedTeam = (member) =>
    entries.find((entry) =>
      entry.members.some((item) => item.userId === member.userId),
    );
  const removalError = (member) => {
    if (member.role === "MANAGER" || member.userId === context.user.id)
      return [
        "SPACE_MANAGER_REMOVAL_NOT_ALLOWED",
        "스페이스 관리자와 본인은 삭제할 수 없습니다.",
      ];
    if (space.membershipLockedAt)
      return [
        "MEMBERSHIP_LOCKED",
        "평가 시작 후에는 스페이스 구성을 변경할 수 없습니다.",
      ];
    const entry = approvedTeam(member);
    if (entry?.team.leaderId === member.userId)
      return [
        "TEAM_LEADER_REMOVAL_NOT_ALLOWED",
        "팀 리더는 삭제할 수 없습니다.",
      ];
    if (
      entry &&
      (entry.tasks.some((task) =>
        task.assignees.some((item) => item.userId === member.userId),
      ) ||
        entry.deliverables.some(
          (item) => item.taskId == null && item.authorId === member.userId,
        ))
    )
      return [
        "SPACE_MEMBER_HAS_DEPENDENCIES",
        "담당 작업이나 미연결 산출물을 먼저 정리해 주세요.",
      ];
    return null;
  };
  const members = state.spaceParticipantMemberships.filter(
    (item) => item.spaceId === spaceId,
  );
  if (method === "GET" && parts.length === 5) {
    return [...members]
      .sort(
        (a, b) =>
          Number(b.role === "MANAGER") - Number(a.role === "MANAGER") ||
          a.joinedAt.localeCompare(b.joinedAt) ||
          a.userId.localeCompare(b.userId),
      )
      .map((member) => {
        const entry = approvedTeam(member);
        return {
          userId: member.userId,
          name: member.name,
          role: member.role,
          joinedAt: member.joinedAt,
          team: entry
            ? {
                teamId: entry.team.id,
                teamName: entry.team.name,
                role:
                  entry.team.leaderId === member.userId ? "LEADER" : "MEMBER",
              }
            : null,
          canRemove: !removalError(member),
        };
      });
  }
  if (method !== "DELETE" || parts.length !== 6)
    fail("NOT_FOUND", "지원하지 않는 API입니다.", 404);
  const userId = parts[5];
  if (!uuid.test(userId))
    fail("INVALID_REQUEST", "참여자 ID를 확인해 주세요.", 400);
  const member = members.find((item) => item.userId === userId);
  if (!member)
    fail(
      "SPACE_MEMBER_NOT_FOUND",
      "이미 삭제되었거나 스페이스에 없는 참여자입니다.",
      404,
    );
  const blocked = removalError(member);
  if (blocked) fail(...blocked);
  for (const entry of entries) {
    if (!entry.members.some((item) => item.userId === userId)) continue;
    entry.members = entry.members.filter((item) => item.userId !== userId);
    entry.team.approvedMemberCount = entry.members.length;
    entry.team.membershipVersion = (entry.team.membershipVersion || 0) + 1;
    if (state.deletion?.teamId === entry.team.id) {
      state.deletion.status = "INVALIDATED";
      state.deletion.canDelete = false;
      state.deletion.workFrozen = false;
    }
    if (state.homePreferences)
      delete state.homePreferences[`${entry.team.id}:${userId}`];
  }
  state.applications = (state.applications || []).filter(
    (item) =>
      item.userId !== userId ||
      !entries.some((entry) => entry.team.id === item.teamId),
  );
  state.spaceParticipantMemberships = state.spaceParticipantMemberships.filter(
    (item) => item.spaceId !== spaceId || item.userId !== userId,
  );
  state.removedSpaceParticipants.push({ spaceId, userId });
  return null;
}
