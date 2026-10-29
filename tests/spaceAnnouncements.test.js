import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getMockState,
  saveMockState,
  resetMockState,
} from "../src/mock/planned.js";
import {
  previewContext,
  previewRequest,
  setPreviewRole,
} from "../src/mock/preview.js";
import { previewSpaceAnnouncements } from "../src/mock/spaceAnnouncements.js";
import {
  announcementPage,
  announcementQuery,
  announcementSearch,
  filterAnnouncements,
  isAnnouncementConflict,
  validateAnnouncement,
} from "../src/lib/spaceAnnouncements.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key),
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const base = "/api/spaces/1/announcements";
const input = {
  title: "  운영 공지  ",
  content: "  첫 줄\n둘째 줄  ",
  pinned: false,
};

test("공지 검색은 현재 페이지의 제목·작성자만 비교하고 페이지와 검색어를 주소에 보존한다", () => {
  const items = [
    { title: "프로젝트 일정", authorName: "정민수" },
    { title: "Design 검토", authorName: "이지원" },
  ];
  assert.deepEqual(filterAnnouncements(items, "  일정  "), [items[0]]);
  assert.deepEqual(filterAnnouncements(items, "정민수"), [items[0]]);
  assert.deepEqual(filterAnnouncements(items, "design"), [items[1]]);
  assert.deepEqual(filterAnnouncements(items, "없는 글"), []);
  assert.equal(filterAnnouncements(items, ""), items);
  const query = announcementQuery(2, " 일정 & 발표 ");
  assert.equal(announcementPage(query), 2);
  assert.equal(announcementSearch(query), "일정 & 발표");
  assert.equal(announcementQuery(0), "");
  assert.equal(announcementSearch(`?q=${"가".repeat(110)}`).length, 100);
});
beforeEach(() => {
  storage.clear();
  setPreviewRole("manager");
  resetMockState(previewContext());
  const state = getMockState(previewContext());
  state.spaceAnnouncements = [];
  saveMockState(previewContext(), state);
});

test("공지 CRUD는 일반 텍스트·작성자·KST와 버전 검사 및 204 삭제 계약을 유지한다", async () => {
  const item = await previewRequest(base, { method: "POST", body: input });
  assert.equal(item.title, "운영 공지");
  assert.equal(item.content, "첫 줄\n둘째 줄");
  assert.equal(item.version, 0);
  assert.equal(item.authorId, previewContext().user.id);
  assert.match(
    item.createdAt,
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?$/,
  );
  const updated = await previewRequest(`${base}/${item.id}`, {
    method: "PATCH",
    body: { ...input, title: "수정 공지", pinned: true, expectedVersion: 0 },
  });
  assert.equal(updated.version, 1);
  assert.equal(updated.createdAt, item.createdAt);
  assert.equal(updated.authorId, item.authorId);
  for (const method of ["PATCH", "DELETE"]) {
    await assert.rejects(
      previewRequest(
        `${base}/${item.id}${method === "DELETE" ? "?expectedVersion=0" : ""}`,
        { method, body: { ...input, expectedVersion: 0 } },
      ),
      { code: "ANNOUNCEMENT_VERSION_CONFLICT", status: 409 },
    );
  }
  assert.equal((await previewRequest(`${base}/${item.id}`)).title, "수정 공지");
  assert.equal(
    await previewRequest(`${base}/${item.id}?expectedVersion=1`, {
      method: "DELETE",
    }),
    null,
  );
  assert.deepEqual(await previewRequest(base), []);
  await assert.rejects(previewRequest(`${base}/${item.id}`), {
    code: "ANNOUNCEMENT_NOT_FOUND",
    status: 404,
  });
  const next = await previewRequest(base, { method: "POST", body: input });
  assert.ok(next.id > item.id);
});

test("스페이스 USER와 팀 리더는 읽기만 가능하고 PENDING·다른 스페이스 접근은 거부한다", async () => {
  const item = await previewRequest(base, { method: "POST", body: input });
  for (const role of ["leader", "member", "participant"]) {
    setPreviewRole(role);
    assert.equal((await previewRequest(base)).length, 1);
    assert.equal((await previewRequest(`${base}/${item.id}`)).id, item.id);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const path =
        method === "POST" ? base : `${base}/${item.id}?expectedVersion=0`;
      await assert.rejects(
        previewRequest(path, {
          method,
          body: { ...input, expectedVersion: 0 },
        }),
        { status: 403 },
      );
    }
  }
  const context = previewContext();
  const state = getMockState(context);
  for (const myRole of ["PENDING", null]) {
    assert.throws(
      () =>
        previewSpaceAnnouncements(
          { ...context, space: { ...context.space, myRole } },
          state,
          ["api", "spaces", "1", "announcements"],
          new URL(base, "https://mock.local"),
          "GET",
        ),
      { status: 403 },
    );
  }
  state.extraSpace = { id: 2, myRole: "USER" };
  saveMockState(context, state);
  await assert.rejects(
    previewRequest(`/api/spaces/2/announcements/${item.id}`),
    { status: 403 },
  );
  await assert.rejects(previewRequest("/api/spaces/99/announcements"), {
    status: 404,
  });
});

test("고정 우선·생성일·ID 역순 배열 페이지와 마지막 빈 페이지를 유지한다", async () => {
  const context = previewContext();
  const state = getMockState(context);
  state.spaceAnnouncements = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    spaceId: 1,
    title: `${index + 1}`,
    pinned: index === 0,
    createdAt: "2026-10-20T09:00:00",
  }));
  saveMockState(context, state);
  const first = await previewRequest(`${base}?page=0&size=20`);
  assert.equal(first.length, 20);
  assert.equal(first[0].id, 1);
  assert.equal(first[1].id, 21);
  assert.equal((await previewRequest(`${base}?page=1&size=20`))[0].id, 2);
  assert.deepEqual(await previewRequest(`${base}?page=2&size=20`), []);
  for (const query of ["page=-1", "page=0.1", "size=0", "size=101"])
    await assert.rejects(previewRequest(`${base}?${query}`), { status: 400 });
});

test("제목·본문 길이와 전체 수정 필드를 검증하고 최대 길이는 허용한다", async () => {
  for (const body of [
    { ...input, title: " " },
    { ...input, title: null },
    { ...input, title: "가".repeat(101) },
    { ...input, content: " \n " },
    { ...input, content: "가".repeat(5001) },
    { ...input, pinned: null },
  ])
    await assert.rejects(previewRequest(base, { method: "POST", body }), {
      status: 400,
    });
  const item = await previewRequest(base, {
    method: "POST",
    body: { title: "가".repeat(100), content: "가".repeat(5000) },
  });
  assert.equal(item.pinned, false);
  await assert.rejects(
    previewRequest(`${base}/${item.id}`, {
      method: "PATCH",
      body: { title: "제목", content: "본문", expectedVersion: 0 },
    }),
    { status: 400 },
  );
  await assert.rejects(
    previewRequest(`${base}/${item.id}`, { method: "DELETE" }),
    { status: 400 },
  );
  assert.equal(validateAnnouncement({ title: "제목", content: "본문" }), null);
});

test("공지 페이지와 충돌 식별은 잘못된 값을 안전하게 처리한다", () => {
  assert.equal(announcementPage("?page=2"), 2);
  for (const value of ["-1", "abc", "1.2", "Infinity", "2147483647"])
    assert.equal(announcementPage(`?page=${value}`), 0);
  assert.equal(
    isAnnouncementConflict({
      status: 409,
      code: "ANNOUNCEMENT_VERSION_CONFLICT",
    }),
    true,
  );
  assert.equal(
    isAnnouncementConflict({ status: 403, code: "FORBIDDEN" }),
    false,
  );
});
