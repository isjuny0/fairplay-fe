import { test, expect } from "@playwright/test";
import { fillDateTime } from "./helpers/dateTime.js";

const path = "/spaces/1/teams/1/meeting-minutes";
const base = "/api/teams/1/meeting-minutes";
const id = (number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const makeItem = (number) => ({
  id: number,
  teamId: 1,
  title: `주간 회의 ${number}`,
  meetingAt: "2026-10-27T19:00:32.123456",
  authorId: id(2),
  authorName: "다른 작성자",
  agenda: "- 진행 상황",
  content: "**공동 기록**",
  decisions: "",
  attendees: [
    { userId: id(2), name: "다른 작성자" },
    { userId: id(9), name: "탈퇴한 참석자" },
  ],
  version: 0,
  createdAt: "2026-10-26T09:00:00",
  updatedAt: "2026-10-26T09:00:00",
});

async function backend(
  page,
  {
    count = 2,
    status = "APPROVED",
    role = "USER",
    frozen = false,
    single = false,
  } = {},
) {
  const items = Array.from({ length: count }, (_, index) =>
    makeItem(index + 1),
  );
  const calls = [],
    control = {
      denied: false,
      failWrite: false,
      failList: false,
      foreign: false,
      freezeWrite: false,
    };
  const space = {
    id: 1,
    name: "회의록 프로젝트",
    myRole: role,
    teamBuildingStatus: "LOCKED",
    endAt: "2020-01-01T00:00:00",
  };
  const team = {
    id: 1,
    spaceId: 1,
    name: "협업 팀",
    leaderId: id(2),
    myMembershipStatus: status,
    approvedMemberCount: single ? 1 : 2,
    canCreateTask: false,
  };
  const members = [
    { userId: id(1), name: "현재 팀원", role: "MEMBER" },
    ...(!single
      ? [{ userId: id(2), name: "다른 작성자", role: "LEADER" }]
      : []),
  ];
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      target = url.pathname,
      method = request.method();
    if (!target.startsWith("/api/")) return route.continue();
    calls.push({
      target,
      method,
      query: url.search,
      body: request.postDataJSON(),
      headers: request.headers(),
    });
    const reply = (json, status = 200) => route.fulfill({ json, status });
    const fail = (code, message, status) => reply({ code, message }, status);
    if (target === "/api/me") return reply({ id: id(1), name: "현재 팀원" });
    if (target === "/api/auth/csrf")
      return reply({ headerName: "X-CSRF-TOKEN", token: "meeting-token" });
    if (target === "/api/spaces") return reply([space]);
    if (target === "/api/spaces/1") return reply(space);
    if (target === "/api/spaces/1/teams") return reply([team]);
    if (target === "/api/teams/1") return reply(team);
    if (target === "/api/teams/1/members") return reply(members);
    if (target === "/api/teams/1/deletion-request")
      return frozen
        ? reply({
            teamId: 1,
            workFrozen: true,
            status: "REQUESTED",
            consents: [],
          })
        : fail("TEAM_DELETION_REQUEST_NOT_FOUND", "요청 없음", 404);
    if (target !== base && !target.startsWith("/api/meeting-minutes/"))
      return fail("TEST_NOT_FOUND", target, 404);
    if (control.denied)
      return fail("FORBIDDEN", "팀원 접근 권한이 없습니다.", 403);
    const itemId = target === base ? null : Number(target.split("/").at(-1)),
      item = items.find((entry) => entry.id === itemId);
    if (itemId != null && !item)
      return fail("MEETING_MINUTE_NOT_FOUND", "회의록이 삭제되었습니다.", 404);
    if (method === "GET") {
      if (control.failList) return fail("UNAVAILABLE", "회의록 조회 실패", 503);
      if (itemId != null)
        return reply(control.foreign ? { ...item, teamId: 2 } : item);
      const number = Number(url.searchParams.get("page") || 0),
        size = Number(url.searchParams.get("size") || 20);
      return reply(
        [...items]
          .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt) || b.id - a.id)
          .slice(number * size, (number + 1) * size)
          .map(({ agenda, content, decisions, attendees, ...summary }) => ({
            ...summary,
            attendeeCount: attendees.length,
          })),
      );
    }
    if (control.freezeWrite)
      return fail("TEAM_DELETION_IN_PROGRESS", "팀 삭제 동의 중입니다.", 409);
    if (control.failWrite) return fail("UNAVAILABLE", "회의록 저장 실패", 503);
    const body = request.postDataJSON();
    if (
      method !== "POST" &&
      Number(
        method === "DELETE"
          ? url.searchParams.get("expectedVersion")
          : body.expectedVersion,
      ) !== item.version
    )
      return fail(
        "MEETING_MINUTE_VERSION_CONFLICT",
        "다른 팀원이 회의록을 변경했습니다.",
        409,
      );
    if (method === "DELETE") {
      items.splice(items.indexOf(item), 1);
      return route.fulfill({ status: 204 });
    }
    const values = { ...body };
    delete values.expectedVersion;
    if (values.attendeeIds) {
      values.attendees = values.attendeeIds.map((userId) =>
        [...members, ...(item?.attendees || [])].find(
          (person) => person.userId === userId,
        ),
      );
      delete values.attendeeIds;
    }
    if (method === "POST") {
      const created = {
        ...makeItem(Math.max(0, ...items.map((record) => record.id)) + 1),
        agenda: "",
        content: "",
        decisions: "",
        attendees: [],
        ...values,
        authorId: id(1),
        authorName: "현재 팀원",
      };
      items.push(created);
      return reply(created, 201);
    }
    Object.assign(item, values, {
      version: item.version + 1,
      updatedAt: "2026-10-27T20:00:00",
    });
    return reply(item);
  });
  return { items, calls, control, team, members };
}

async function editor(page) {
  await page.getByRole("button", { name: "회의록 등록", exact: true }).click();
  return page.getByRole("dialog", { name: "팀 회의록 등록", exact: true });
}

test("팀 작업 메뉴에서 등록·상세·공동 수정·삭제와 KST·CSRF·부분 수정 계약을 확인한다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(path);
  await expect(
    page
      .locator('[data-navigation-group="팀 작업"]')
      .getByRole("button", { name: "회의록", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator(".meeting-minutes-page > .page-heading p"),
  ).toHaveCount(0);
  await expect(
    page.locator(".meeting-minutes-page > .page-heading"),
  ).toHaveCSS("border-bottom-width", "1px");
  await expect(
    page.getByRole("list", { name: "팀 회의록 목록" }),
  ).toHaveCSS("border-top-width", "0px");
  const dialog = await editor(page);
  await dialog.getByLabel("제목", { exact: true }).fill("신규 회의");
  await fillDateTime(dialog, "회의일시", "2026-11-01T19:30");
  await dialog.getByLabel("현재 팀원", { exact: true }).check();
  await dialog
    .getByRole("textbox", { name: "안건", exact: true })
    .fill(" 안건\n ");
  await dialog.getByRole("button", { name: "논의 내용", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "논의 내용", exact: true })
    .fill("**작성 내용**");
  await dialog.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(
    dialog.getByRole("region", { name: "본문 미리보기" }),
  ).toContainText("작성 내용");
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "신규 회의", exact: true }),
  ).toBeVisible();
  const created = api.calls.find(
    (call) => call.method === "POST" && call.target === base,
  );
  expect(created.body).toMatchObject({
    meetingAt: "2026-11-01T19:30:00",
    agenda: " 안건\n ",
    content: "**작성 내용**",
    decisions: "",
    attendeeIds: [id(1)],
  });
  expect(created.headers["x-csrf-token"]).toBe("meeting-token");
  await page.getByRole("button", { name: "← 목록으로" }).click();
  await page
    .getByRole("list", { name: "팀 회의록 목록" })
    .getByRole("button", { name: "주간 회의 1", exact: true })
    .click();
  await page.getByRole("button", { name: "회의록 수정", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "팀 회의록 수정" });
  await expect(edit.getByLabel("탈퇴한 참석자 · 이전 참석자")).toBeChecked();
  await edit.getByLabel("제목", { exact: true }).fill("팀원이 공동 수정");
  await edit.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "팀원이 공동 수정" }),
  ).toBeVisible();
  const patch = api.calls.find((call) => call.method === "PATCH");
  expect(patch.body).toEqual({ title: "팀원이 공동 수정", expectedVersion: 0 });
  expect(api.items.find((item) => item.id === 1).meetingAt).toBe(
    "2026-10-27T19:00:32.123456",
  );
  await page.getByRole("button", { name: "회의록 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "팀 회의록 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  expect(api.calls.find((call) => call.method === "DELETE")).toMatchObject({
    query: "?expectedVersion=1",
    body: null,
  });
});

test("버전 충돌은 입력을 보존하고 최신 필드 비교와 확인 후 바뀐 항목만 저장한다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(`${path}/1`);
  await page.getByRole("button", { name: "회의록 수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "팀 회의록 수정" });
  await dialog.getByLabel("제목", { exact: true }).fill("내 수정");
  api.items[0].version = 1;
  api.items[0].title = "서버 최신 제목";
  api.items[0].content = "다른 팀원의 최신 논의";
  await dialog.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(dialog.getByLabel("제목", { exact: true })).toHaveValue(
    "내 수정",
  );
  await expect(
    dialog.getByRole("button", { name: "수정 저장", exact: true }),
  ).toBeDisabled();
  api.control.failList = true;
  await dialog
    .getByRole("button", { name: "최신 내용 확인", exact: true })
    .click();
  await expect(dialog.locator(".save-recovery")).toContainText(
    "회의록 조회 실패",
  );
  await expect(
    dialog.getByRole("button", { name: "수정 저장", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("제목", { exact: true })).toHaveValue(
    "내 수정",
  );
  api.control.failList = false;
  await dialog
    .getByRole("button", { name: "최신 내용 확인", exact: true })
    .click();
  await expect(dialog.locator(".save-comparison")).toContainText(
    "서버 최신 제목",
  );
  expect(api.calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  await dialog.getByRole("button", { name: "수정 저장", exact: true }).click();
  await page
    .getByRole("dialog", { name: "최신 내용에 내 수정 반영" })
    .getByRole("button", { name: "내 수정 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "내 수정", exact: true }),
  ).toBeVisible();
  expect(api.items[0].content).toBe("다른 팀원의 최신 논의");
  expect(
    api.calls.filter((call) => call.method === "PATCH").at(-1).body,
  ).toEqual({ title: "내 수정", expectedVersion: 1 });
});

test("저장 실패·미저장 닫기 확인 및 빈 본문 등록을 처리한다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(path);
  const dialog = await editor(page);
  await dialog.getByLabel("제목", { exact: true }).fill(" ");
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    dialog.getByText("제목은 공백을 제외하고 1~100자로 입력해 주세요.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(api.calls.filter((call) => call.method === "POST")).toHaveLength(0);
  await expect(dialog.getByLabel("제목", { exact: true })).toBeFocused();
  await dialog.getByLabel("제목", { exact: true }).fill("제목과 일시만");
  await fillDateTime(dialog, "회의일시", "2031-01-01T19:00");
  api.control.failWrite = true;
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    dialog.getByText("입력한 내용은 유지하고 있습니다"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await page
    .getByRole("dialog", { name: "입력 내용 버리기" })
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await expect(dialog.getByLabel("제목", { exact: true })).toHaveValue(
    "제목과 일시만",
  );
  api.control.failWrite = false;
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "제목과 일시만", exact: true }),
  ).toBeVisible();
  expect(api.items.at(-1).attendees).toEqual([]);
});

test("목록 페이지·상세 새로고침·뒤로가기와 마지막 항목 삭제를 처리한다", async ({
  page,
}) => {
  const api = await backend(page, { count: 21 });
  await page.goto(path);
  await expect(page.getByRole("listitem")).toHaveCount(20);
  await page
    .getByRole("navigation", { name: "회의록 목록 페이지" })
    .getByRole("button", { name: "다음", exact: true })
    .click();
  await expect(page).toHaveURL(/page=1$/);
  await page.getByRole("listitem").getByRole("button").click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "주간 회의 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "← 목록으로" }).click();
  await expect(page).toHaveURL(/page=1$/);
  await page.getByRole("listitem").getByRole("button").click();
  await page.getByRole("button", { name: "회의록 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "팀 회의록 삭제" })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  expect(api.items).toHaveLength(20);
});

for (const options of [
  { status: "PENDING" },
  { status: null, role: "MANAGER" },
])
  test(`비승인 ${options.role || "USER"}은 메뉴·회의록 API에 접근하지 못한다`, async ({
    page,
  }) => {
    const api = await backend(page, options);
    await page.goto(path);
    await expect(
      page.getByRole("heading", {
        name:
          options.role === "MANAGER"
            ? "이 팀 화면에 접근할 수 없습니다."
            : "팀을 열 수 없습니다.",
      }),
    ).toBeVisible();
    expect(
      api.calls.some((call) => call.target.includes("meeting-minutes")),
    ).toBe(false);
    await expect(
      page
        .locator(".desktop-team-navigation")
        .getByRole("button", { name: "회의록", exact: true }),
    ).toHaveCount(0);
  });

test("승인된 관리자와 1인 팀은 종료된 스페이스에서도 작성할 수 있다", async ({
  page,
}) => {
  await backend(page, { role: "MANAGER", single: true });
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "회의록 등록", exact: true }),
  ).toBeEnabled();
  const dialog = await editor(page);
  await dialog.getByLabel("제목", { exact: true }).fill("혼자 기록");
  await fillDateTime(dialog, "회의일시", "2026-10-27T09:00");
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "혼자 기록", exact: true }),
  ).toBeVisible();
});

test("팀 삭제 동의 중 회의록 조회만 허용한다", async ({ page }) => {
  const api = await backend(page, { frozen: true });
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "회의록 등록", exact: true }),
  ).toBeDisabled();
  await page.getByRole("listitem").first().getByRole("button").click();
  await expect(
    page.getByRole("button", { name: "회의록 수정", exact: true }),
  ).toBeDisabled();
  expect(api.calls.some((call) => call.method === "POST")).toBe(false);
});

test("편집 중 시작된 삭제 동의는 입력을 보존하며 변경 요청을 재전송하지 않는다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(`${path}/1`);
  await page.getByRole("button", { name: "회의록 수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "팀 회의록 수정" });
  await dialog.getByLabel("제목", { exact: true }).fill("동결 시 보존할 제목");
  api.control.freezeWrite = true;
  await dialog.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(dialog.getByLabel("제목", { exact: true })).toHaveValue(
    "동결 시 보존할 제목",
  );
  await expect(
    dialog.getByRole("button", { name: "수정 저장", exact: true }),
  ).toBeDisabled();
  expect(api.calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
});

test("빈 목록·조회 실패·재조회와 서버에서 삭제된 편집 대상의 입력 보존을 처리한다", async ({
  page,
}) => {
  const api = await backend(page, { count: 0 });
  await page.goto(`${path}?page=2147483647`);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  expect(
    api.calls
      .filter((call) => call.target === base)
      .every((call) =>
        ["0", "2147483647"].includes(
          new URLSearchParams(call.query).get("page"),
        ),
      ),
  ).toBe(true);
  await expect(page.getByText("등록된 팀 회의록이 없습니다.")).toBeVisible();
  api.control.failList = true;
  await page
    .getByRole("button", { name: "회의록 새로고침", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("회의록 조회 실패");
  api.control.failList = false;
  api.items.push(makeItem(1));
  await page
    .getByRole("button", { name: "다시 불러오기", exact: true })
    .click();
  await page.getByRole("listitem").getByRole("button").click();
  await page.getByRole("button", { name: "회의록 수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "팀 회의록 수정" });
  await dialog.getByLabel("제목", { exact: true }).fill("삭제된 회의의 초안");
  api.items.length = 0;
  await dialog.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "회의록이 삭제되었습니다.",
  );
  await expect(dialog.getByLabel("제목", { exact: true })).toHaveValue(
    "삭제된 회의의 초안",
  );
  await expect(
    dialog.getByRole("button", { name: "수정 저장", exact: true }),
  ).toBeDisabled();
});

test("권한 회수·다른 팀 응답·삭제된 회의록은 이전 원문을 표시하지 않는다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(`${path}/1`);
  await expect(
    page.getByRole("heading", { name: "주간 회의 1", exact: true }),
  ).toBeVisible();
  api.control.foreign = true;
  await page
    .getByRole("button", { name: "회의록 새로고침", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "이 팀의 회의록이 아닙니다.",
  );
  await expect(page.locator(".meeting-detail")).toHaveCount(0);
  api.control.foreign = false;
  api.items.splice(0, 1);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "회의록이 삭제되었습니다.",
  );
});

test("편집 중 접근 권한이 사라지면 원문과 모달을 숨기고 자동 재요청하지 않는다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(`${path}/1`);
  await page.getByRole("button", { name: "회의록 수정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "팀 회의록 수정" });
  await dialog.getByLabel("제목", { exact: true }).fill("보존할 입력");
  api.control.denied = true;
  await dialog.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".meeting-detail")).toHaveCount(0);
  expect(api.calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
});

test("삭제 충돌은 재조회 후 재확인을 요구하고 자동 재삭제하지 않는다", async ({
  page,
}) => {
  const api = await backend(page);
  await page.goto(`${path}/1`);
  await page.getByRole("button", { name: "회의록 삭제", exact: true }).click();
  api.items[0].version = 1;
  api.items[0].title = "보존할 최신 회의";
  await page
    .getByRole("dialog", { name: "팀 회의록 삭제" })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "보존할 최신 회의", exact: true }),
  ).toBeVisible();
  expect(api.calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
  expect(api.items).toHaveLength(2);
});

for (const width of [320, 390, 1440])
  test(`${width}px 목록·상세·마크다운 모달에 가로 넘침 없이 저장 버튼에 접근한다`, async ({
    page,
  }, testInfo) => {
    const api = await backend(page);
    api.items[0].title = "긴회의제목".repeat(20);
    api.items[0].content =
      "<script>window.badMeeting = true</script>\n[위험](javascript:alert(1))\n\n| 항목 | 내용 |\n| --- | --- |\n| 확인 | 안전한 문서 |";
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(`${path}/1`);
    await expect(page.getByRole("region", { name: "문서 표" })).toContainText(
      "안전한 문서",
    );
    expect(await page.evaluate(() => window.badMeeting)).toBeUndefined();
    await expect(
      page.locator('.meeting-detail a[href^="javascript:"]'),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "회의록 수정", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "팀 회의록 수정" });
    await dialog.getByLabel("제목", { exact: true }).fill("반응형 확인");
    const save = dialog.getByRole("button", { name: "수정 저장", exact: true });
    await expect(save).toBeInViewport();
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await dialog
      .getByRole("button", { name: "논의 내용", exact: true })
      .scrollIntoViewIfNeeded();
    await dialog
      .getByRole("button", { name: "논의 내용", exact: true })
      .click();
    await expect(
      dialog.getByRole("textbox", { name: "논의 내용", exact: true }),
    ).toBeVisible();
    await expect(save).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath(`meeting-editor-${width}.png`),
    });
    await save.click();
    await expect(
      page.getByRole("heading", { name: "반응형 확인", exact: true }),
    ).toBeVisible();
  });

test("미리보기 CRUD는 실제 서버를 호출하지 않고 새로고침 후에도 유지된다", async ({
  page,
}) => {
  const calls = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      calls.push(request.url());
  });
  await page.goto(`/preview${path}`);
  const dialog = await editor(page);
  await dialog.getByLabel("제목", { exact: true }).fill("미리보기 회의");
  await fillDateTime(dialog, "회의일시", "2026-10-27T19:00");
  await dialog.getByRole("button", { name: "등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "미리보기 회의", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "미리보기 회의", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "회의록 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "팀 회의록 삭제" })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/preview${path}$`));
  await expect(
    page.getByRole("list", { name: "팀 회의록 목록" }),
  ).not.toContainText("미리보기 회의");
  expect(calls).toEqual([]);
});
