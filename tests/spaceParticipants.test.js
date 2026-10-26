import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getMockState,
  resetMockState,
  saveMockState,
} from "../src/mock/planned.js";
import {
  previewContext,
  previewRequest,
  setPreviewRole,
} from "../src/mock/preview.js";
import { participantRemovalHint } from "../src/lib/spaceParticipants.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const base = "/api/spaces/1/manager-dashboard/members";
const id = (number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
beforeEach(() => {
  storage.clear();
  setPreviewRole("manager");
  resetMockState(previewContext(), "building");
});

test("참여자 명단은 관리자 우선이며 팀 미소속·신청자도 승인 팀 없이 포함하고 민감정보를 반환하지 않는다", async () => {
  const rows = await previewRequest(base);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].role, "MANAGER");
  assert.deepEqual(
    Object.keys(rows[0]).sort(),
    ["userId", "name", "role", "joinedAt", "team", "canRemove"].sort(),
  );
  assert.equal(rows.find((row) => row.userId === id(7)).team, null);
  assert.equal(rows.find((row) => row.userId === id(1)).team.role, "LEADER");
  assert.equal(rows.find((row) => row.userId === id(3)).canRemove, true);
  const state = getMockState(previewContext());
  const before = structuredClone(state);
  await previewRequest(base);
  assert.deepEqual(getMockState(previewContext()), before);
});

test("참여자 삭제는 소속·신청·개인 설정만 정리하고 팀·공유 자료·다른 스페이스는 보존한다", async () => {
  await previewRequest(base);
  const context = previewContext(),
    state = getMockState(context);
  state.teams[9] = {
    team: { id: 9, spaceId: 2 },
    members: [{ userId: id(3) }],
    tasks: [],
    deliverables: [],
  };
  state.applications.push(
    { teamId: 2, userId: id(3), status: "REJECTED" },
    { teamId: 9, userId: id(3), status: "PENDING" },
  );
  state.homePreferences = {
    [`1:${id(3)}`]: { memo: "내 메모" },
    [`1:${id(2)}`]: { memo: "다른 메모" },
  };
  state.calendarEvents = [{ id: 1, teamId: 1, authorId: id(3) }];
  state.deletion = {
    teamId: 1,
    status: "READY",
    workFrozen: true,
    canDelete: true,
  };
  const oldTeam = structuredClone(state.teams[1]);
  saveMockState(context, state);
  assert.equal(
    await previewRequest(`${base}/${id(3)}`, { method: "DELETE" }),
    null,
  );
  const after = getMockState(context);
  assert.equal(after.teams[1].members.length, 2);
  assert.equal(after.teams[1].team.membershipVersion, 1);
  assert.equal(after.deletion.status, "INVALIDATED");
  assert.equal(after.homePreferences[`1:${id(3)}`], undefined);
  assert.ok(after.homePreferences[`1:${id(2)}`]);
  assert.deepEqual(after.teams[1].tasks, oldTeam.tasks);
  assert.deepEqual(after.teams[1].deliverables, oldTeam.deliverables);
  assert.equal(after.calendarEvents.length, 1);
  assert.equal(after.teams[9].members.length, 1);
  assert.equal(
    after.applications.filter((item) => item.userId === id(3)).length,
    1,
  );
  assert.equal(
    (await previewRequest(base)).some((row) => row.userId === id(3)),
    false,
  );
  await assert.rejects(
    previewRequest(`${base}/${id(3)}`, { method: "DELETE" }),
    { code: "SPACE_MEMBER_NOT_FOUND", status: 404 },
  );
});

test("관리자·팀 리더·완료 작업 담당자는 보호하고 업무 의존성을 다시 검사한다", async () => {
  for (const [number, code] of [
    [4, "SPACE_MANAGER_REMOVAL_NOT_ALLOWED"],
    [1, "TEAM_LEADER_REMOVAL_NOT_ALLOWED"],
    [2, "SPACE_MEMBER_HAS_DEPENDENCIES"],
  ])
    await assert.rejects(
      previewRequest(`${base}/${id(number)}`, { method: "DELETE" }),
      { code, status: 409 },
    );
  const context = previewContext(),
    state = getMockState(context);
  state.teams[1].deliverables.push({ id: 999, taskId: null, authorId: id(3) });
  saveMockState(context, state);
  assert.equal(
    (await previewRequest(base)).find((row) => row.userId === id(3)).canRemove,
    false,
  );
  await assert.rejects(
    previewRequest(`${base}/${id(3)}`, { method: "DELETE" }),
    { code: "SPACE_MEMBER_HAS_DEPENDENCIES" },
  );
});

test("기간 종료만으로 삭제를 막지 않지만 구성 잠금 후에는 조회만 유지한다", async () => {
  const context = previewContext(),
    state = getMockState(context);
  state.spaceOverrides = {
    membershipLockedAt: null,
    teamBuildingStatus: "CLOSED",
  };
  saveMockState(context, state);
  assert.equal(
    (await previewRequest(base)).find((row) => row.userId === id(7)).canRemove,
    true,
  );
  state.spaceOverrides.membershipLockedAt = "2026-10-26T09:00:00";
  saveMockState(context, state);
  assert.equal(
    (await previewRequest(base)).every((row) => !row.canRemove),
    true,
  );
  await assert.rejects(
    previewRequest(`${base}/${id(7)}`, { method: "DELETE" }),
    { code: "MEMBERSHIP_LOCKED" },
  );
});

test("다른 스페이스·잘못된 ID·일반 회원 요청은 명단을 노출하지 않는다", async () => {
  await assert.rejects(
    previewRequest("/api/spaces/999/manager-dashboard/members"),
    { code: "SPACE_NOT_FOUND", status: 404 },
  );
  await assert.rejects(previewRequest(`${base}/bad`, { method: "DELETE" }), {
    code: "INVALID_REQUEST",
    status: 400,
  });
  setPreviewRole("leader");
  await assert.rejects(previewRequest(base), {
    code: "FORBIDDEN",
    status: 403,
  });
});

test("제거 후 역할 전환에도 접근을 해제하고 재가입해도 이전 팀·신청을 복구하지 않는다", async () => {
  await previewRequest(`${base}/${id(3)}`, { method: "DELETE" });
  setPreviewRole("teammate");
  assert.deepEqual(await previewRequest("/api/spaces"), []);
  await assert.rejects(previewRequest("/api/spaces/1"), { code: "FORBIDDEN" });
  await assert.rejects(previewRequest("/api/teams/1"), { code: "FORBIDDEN" });
  await previewRequest("/api/spaces/join", {
    method: "POST",
    body: { code: "PREVIEW" },
  });
  assert.equal((await previewRequest("/api/spaces")).length, 1);
  assert.equal((await previewRequest("/api/teams/1")).myMembershipStatus, null);
});

test("화면 삭제 조건은 서버 canRemove와 관리자·본인·리더 보호를 함께 따른다", () => {
  const member = { userId: id(3), role: "USER", canRemove: true, team: null };
  assert.equal(participantRemovalHint(member, id(4)), "");
  for (const change of [
    { canRemove: false },
    { role: "MANAGER" },
    { team: { role: "LEADER" } },
  ])
    assert.ok(participantRemovalHint({ ...member, ...change }, id(4)));
  assert.ok(participantRemovalHint(member, id(3)));
});
