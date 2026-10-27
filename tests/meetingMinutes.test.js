import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  meetingDraft,
  meetingInput,
  validMeetingTime,
  validateMeetingMinute,
} from "../src/lib/meetingMinutes.js";
import {
  previewContext,
  previewRequest,
  setPreviewRole,
} from "../src/mock/preview.js";
import {
  getMockState,
  resetMockState,
  saveMockState,
} from "../src/mock/planned.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const base = "/api/teams/1/meeting-minutes";
const id = (number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const input = { title: "주간 회의", meetingAt: "2026-10-27T19:00:00" };
beforeEach(() => {
  storage.clear();
  setPreviewRole("leader");
  resetMockState(previewContext(), "active");
});
const changeState = (change) => {
  const context = previewContext(),
    state = getMockState(context);
  change(state);
  saveMockState(context, state);
};

test("회의록은 제목·일시만 필수이며 원문과 빈 값 및 한국 일시 경계를 검증한다", () => {
  assert.deepEqual(validateMeetingMinute(input), {});
  assert.deepEqual(
    validateMeetingMinute({
      ...input,
      agenda: "",
      content: " ".repeat(20000),
      decisions: "",
      attendeeIds: [],
    }),
    {},
  );
  for (const field of [
    "title",
    "meetingAt",
    "agenda",
    "content",
    "decisions",
    "attendeeIds",
  ])
    assert.ok(validateMeetingMinute({ ...input, [field]: null })[field]);
  assert.ok(validateMeetingMinute({ ...input, title: " " }).title);
  assert.ok(
    validateMeetingMinute({ ...input, agenda: "a".repeat(5001) }).agenda,
  );
  assert.ok(
    validateMeetingMinute({ ...input, attendeeIds: [id(1), id(1)] })
      .attendeeIds,
  );
  assert.ok(
    validateMeetingMinute({ ...input, attendeeIds: ["bad"] }).attendeeIds,
  );
  for (const value of [
    "0001-01-01T00:00:00",
    "9999-12-31T23:59:59.123456789",
    "2028-02-29T19:00",
  ])
    assert.equal(validMeetingTime(value), true);
  for (const value of [
    "0000-01-01T00:00",
    "2026-02-29T19:00",
    "2026-10-27T24:00",
    "2026-10-27T19:60",
    "2026-10-27T19:00:60",
    "2026-10-27T19:00Z",
    "2026-10-27T19:00+09:00",
  ])
    assert.equal(validMeetingTime(value), false);
});

test("편집은 바뀐 필드만 전송하고 원문 공백·기존 일시의 초·탈퇴 참석자를 보존한다", () => {
  const item = {
    ...input,
    meetingAt: "2026-10-27T19:00:32.123456",
    content: "원문",
    attendees: [{ userId: id(9), name: "이전 팀원" }],
  };
  const form = meetingDraft(item);
  assert.deepEqual(meetingInput(form, item), {});
  form.content = "\n 새 원문\n ";
  assert.deepEqual(meetingInput(form, item), { content: "\n 새 원문\n " });
  form.attendeeIds = [];
  assert.deepEqual(meetingInput(form, item).attendeeIds, []);
  assert.ok(validateMeetingMinute({ expectedVersion: 0 }, true).title);
});

test("목록은 회의일시·ID 내림차순 페이지 배열이며 본문과 참석자 명단을 노출하지 않는다", async () => {
  await previewRequest(base);
  changeState((state) => {
    state.meetingMinutes = Array.from({ length: 21 }, (_, index) => ({
      ...state.meetingMinutes[0],
      id: index + 10,
    }));
  });
  const first = await previewRequest(`${base}?page=0&size=20`),
    second = await previewRequest(`${base}?page=1&size=20`);
  assert.equal(first.length, 20);
  assert.equal(first[0].id, 30);
  assert.equal(second.length, 1);
  assert.equal("content" in first[0], false);
  assert.equal("attendees" in first[0], false);
  assert.equal(first[0].attendeeCount, 3);
  assert.deepEqual(await previewRequest(`${base}?page=2`), []);
  for (const query of ["page=-1", "page=1.5", "size=0", "size=101"])
    await assert.rejects(previewRequest(`${base}?${query}`), { status: 400 });
});

test("일반 팀원은 타인의 회의록을 공동 수정·삭제하며 다른 자료를 변경하지 않는다", async () => {
  const created = await previewRequest(base, {
    method: "POST",
    body: { ...input, agenda: " 원문\n", attendeeIds: [id(1)] },
  });
  assert.equal(created.version, 0);
  assert.equal(created.content, "");
  assert.equal(created.agenda, " 원문\n");
  const before = structuredClone(getMockState(previewContext()).teams[1]);
  setPreviewRole("member");
  const saved = await previewRequest(`/api/meeting-minutes/${created.id}`, {
    method: "PATCH",
    body: { content: "공동 편집", expectedVersion: 0 },
  });
  assert.equal(saved.authorId, id(1));
  assert.equal(saved.version, 1);
  assert.equal(saved.attendees.length, 1);
  await assert.rejects(
    previewRequest(`/api/meeting-minutes/${created.id}?expectedVersion=0`, {
      method: "DELETE",
    }),
    { code: "MEETING_MINUTE_VERSION_CONFLICT" },
  );
  assert.equal(
    await previewRequest(
      `/api/meeting-minutes/${created.id}?expectedVersion=1`,
      { method: "DELETE" },
    ),
    null,
  );
  await assert.rejects(previewRequest(`/api/meeting-minutes/${created.id}`), {
    code: "MEETING_MINUTE_NOT_FOUND",
  });
  assert.deepEqual(getMockState(previewContext()).teams[1], before);
});

test("승인되지 않은 관리자·신청자·타 팀 사용자는 회의록을 조회하거나 변경하지 못한다", async () => {
  await previewRequest(base);
  for (const role of ["manager", "participant"]) {
    setPreviewRole(role);
    for (const path of [base, "/api/meeting-minutes/1"])
      await assert.rejects(previewRequest(path), { status: 403 });
    await assert.rejects(
      previewRequest(base, { method: "POST", body: input }),
      { status: 403 },
    );
  }
  setPreviewRole("leader");
  await assert.rejects(previewRequest("/api/teams/2/meeting-minutes"), {
    status: 403,
  });
});

test("탈퇴 참석자는 유지·제거할 수 있지만 제거한 뒤 신규 참석자로 다시 추가할 수 없다", async () => {
  const item = await previewRequest(base, {
    method: "POST",
    body: { ...input, attendeeIds: [id(3)] },
  });
  changeState((state) => {
    state.teams[1].members = state.teams[1].members.filter(
      (person) => person.userId !== id(3),
    );
  });
  const path = `/api/meeting-minutes/${item.id}`;
  const kept = await previewRequest(path, {
    method: "PATCH",
    body: { expectedVersion: 0, attendeeIds: [id(3)], agenda: "회의 전 안건" },
  });
  assert.equal(kept.attendees[0].userId, id(3));
  await previewRequest(path, {
    method: "PATCH",
    body: { expectedVersion: 1, attendeeIds: [] },
  });
  await assert.rejects(
    previewRequest(path, {
      method: "PATCH",
      body: { expectedVersion: 2, attendeeIds: [id(3)] },
    }),
    { status: 400 },
  );
  assert.equal((await previewRequest(path)).version, 2);
});

test("1인 팀·MID 잠금·FINAL 마감 후에도 회의록을 작성하고 팀 삭제 동의 중에는 조회만 한다", async () => {
  changeState((state) => {
    state.teams[1].members = state.teams[1].members.slice(0, 1);
    state.rounds.forEach((round) => {
      round.status = "CLOSED";
      round.closesAt = "2020-01-01T00:00:00";
    });
  });
  const item = await previewRequest(base, { method: "POST", body: input });
  changeState((state) => {
    state.deletion = { teamId: 1, workFrozen: true };
  });
  const path = `/api/meeting-minutes/${item.id}`;
  assert.equal((await previewRequest(path)).id, item.id);
  await previewRequest(base);
  for (const [target, method, body] of [
    [base, "POST", input],
    [path, "PATCH", { title: "수정", expectedVersion: 0 }],
    [`${path}?expectedVersion=0`, "DELETE", {}],
  ])
    await assert.rejects(previewRequest(target, { method, body }), {
      code: "TEAM_DELETION_IN_PROGRESS",
    });
});

test("미리보기 입력·버전 오류는 원본을 보존하고 참여자 제거 시 접근을 회수하지만 기록은 남긴다", async () => {
  await previewRequest(base);
  const before = await previewRequest("/api/meeting-minutes/1");
  for (const body of [
    { expectedVersion: 0, content: null },
    { expectedVersion: -1, content: "a" },
    { expectedVersion: 0 },
  ])
    await assert.rejects(
      previewRequest("/api/meeting-minutes/1", { method: "PATCH", body }),
      { status: 400 },
    );
  assert.deepEqual(await previewRequest("/api/meeting-minutes/1"), before);
  changeState((state) => {
    state.removedSpaceParticipants = [{ spaceId: 1, userId: id(1) }];
  });
  await assert.rejects(previewRequest("/api/meeting-minutes/1"), {
    status: 403,
  });
  setPreviewRole("member");
  assert.equal(
    (await previewRequest("/api/meeting-minutes/1")).authorId,
    id(1),
  );
});
