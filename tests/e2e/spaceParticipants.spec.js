import { test, expect } from "@playwright/test";

const path = "/spaces/1/participants";
const base = "/api/spaces/1/manager-dashboard/members";
const id = (number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const member = (number, name, options = {}) => ({
  userId: id(number),
  name,
  role: "USER",
  joinedAt: "2026-10-26T09:30:00",
  team: null,
  canRemove: true,
  ...options,
});

async function backend(page, role = "MANAGER") {
  const control = {
    denied: false,
    listError: null,
    removeError: null,
    slow: false,
  };
  const calls = [];
  const members = [
    member(4, "관리자", { role: "MANAGER", canRemove: false }),
    member(1, "팀 리더", {
      team: { teamId: 1, teamName: "협업 팀", role: "LEADER" },
      canRemove: false,
    }),
    member(2, "참여자", {
      team: { teamId: 1, teamName: "협업 팀", role: "MEMBER" },
    }),
    member(3, "삭제 제한", { canRemove: false }),
    member(7, "미소속 참여자"),
  ];
  const space = {
    id: 1,
    name: "참여자 프로젝트",
    myRole: role,
    teamBuildingStatus: "OPEN",
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) return route.continue();
    calls.push({
      path: url.pathname,
      method: request.method(),
      query: url.search,
      body: request.postData(),
      headers: request.headers(),
    });
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (url.pathname === "/api/me") return reply({ id: id(4), name: "관리자" });
    if (url.pathname === "/api/auth/csrf")
      return reply({ headerName: "X-CSRF-TOKEN", token: "participant-token" });
    if (url.pathname === "/api/spaces") return reply([space]);
    if (url.pathname === "/api/spaces/1") return reply(space);
    if (url.pathname === "/api/spaces/1/teams") return reply([]);
    if (url.pathname === "/api/spaces/1/manager-dashboard")
      return reply({ teams: [] });
    if (url.pathname === "/api/spaces/1/announcements") return reply([]);
    if (!url.pathname.startsWith(base))
      return reply({ code: "TEST_NOT_FOUND", message: url.pathname }, 404);
    if (control.denied)
      return reply(
        { code: "FORBIDDEN", message: "관리자 권한이 없습니다." },
        403,
      );
    if (request.method() === "GET") {
      if (control.listError)
        return reply(control.listError, control.listError.status);
      return reply(members);
    }
    if (control.slow) await new Promise((resolve) => setTimeout(resolve, 500));
    if (control.removeError) {
      const failure = control.removeError;
      if (failure.status === 409)
        members.find(
          (item) => item.userId === url.pathname.split("/").at(-1),
        ).canRemove = false;
      if (failure.code === "SPACE_MEMBER_NOT_FOUND")
        members.splice(
          members.findIndex(
            (item) => item.userId === url.pathname.split("/").at(-1),
          ),
          1,
        );
      if (failure.status === 403) control.denied = true;
      return reply(failure, failure.status);
    }
    members.splice(
      members.findIndex(
        (item) => item.userId === url.pathname.split("/").at(-1),
      ),
      1,
    );
    return route.fulfill({ status: 204 });
  });
  return { calls, members, control };
}

for (const width of [1440, 375]) {
  test(`관리자는 ${width}px에서 전용 메뉴로 목록을 조회하고 확인 후 삭제한다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const { calls } = await backend(page);
    await page.goto("/spaces/1");
    await page
      .getByRole("navigation", {
        name: width <= 720 ? "모바일 관리자 메뉴" : "스페이스 메뉴",
        exact: true,
      })
      .getByRole("button", {
        name: width <= 720 ? "참여자" : "참여자 관리",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    const table = page.getByRole("table", { name: "스페이스 참여자 목록" });
    await expect(table.getByRole("row")).toHaveCount(6);
    await expect(table).toContainText("협업 팀");
    await expect(table).toContainText("미소속");
    for (const name of ["관리자", "팀 리더", "삭제 제한"])
      await expect(
        table.getByRole("button", { name: `${name} 참여자 삭제`, exact: true }),
      ).toBeDisabled();
    const remove = table.getByRole("button", {
      name: "미소속 참여자 참여자 삭제",
      exact: true,
    });
    await remove.click();
    const dialog = page.getByRole("dialog", {
      name: "참여자 삭제",
      exact: true,
    });
    await expect(dialog).toContainText("미소속 참여자");
    await expect(dialog).toContainText(
      "사용자 계정과 다른 스페이스 소속은 유지",
    );
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
    await remove.click();
    await dialog.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(remove).toHaveCount(0);
    await expect(page.locator(".participant-count")).toHaveText("총 4명");
    await expect
      .poll(
        () =>
          calls.filter(
            (call) => call.path === "/api/spaces/1/manager-dashboard",
          ).length,
      )
      .toBe(1);
    const deletion = calls.find((call) => call.method === "DELETE");
    expect(deletion.path).toBe(`${base}/${id(7)}`);
    expect(deletion.query).toBe("");
    expect(deletion.body).toBeNull();
    expect(deletion.headers["x-csrf-token"]).toBe("participant-token");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".space-participants-page")
      .screenshot({ path: testInfo.outputPath("participants.png") });
  });
}

test("일반 참여자·팀 리더는 직접 주소에서도 명단 API를 호출하지 않는다", async ({
  page,
}) => {
  const { calls } = await backend(page, "USER");
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "스페이스 관리 권한이 없습니다." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "참여자 관리", exact: true }),
  ).toHaveCount(0);
  expect(calls.some((call) => call.path === base)).toBe(false);
});

test("목록 오류·빈 목록·미구현 API를 구분하고 수동으로 재조회한다", async ({
  page,
}) => {
  const { control, members } = await backend(page);
  control.listError = {
    status: 404,
    code: "NOT_FOUND",
    message: "아직 API가 없습니다.",
  };
  await page.goto(path);
  await expect(page.getByRole("alert")).toContainText("아직 API가 없습니다.");
  await expect(
    page.getByText("참여자가 없습니다.", { exact: true }),
  ).toHaveCount(0);
  control.listError = null;
  members.length = 0;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(
    page.getByText("참여자가 없습니다.", { exact: true }),
  ).toBeVisible();
  control.listError = {
    status: 503,
    code: "UNAVAILABLE",
    message: "목록 조회 실패",
  };
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("목록 조회 실패");
  control.listError = null;
  members.push(member(7, "다시 조회한 참여자"));
  await page
    .getByRole("button", { name: "다시 불러오기", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("다시 조회한 참여자");
});

for (const code of [
  "MEMBERSHIP_LOCKED",
  "SPACE_MEMBER_HAS_DEPENDENCIES",
  "TEAM_LEADER_REMOVAL_NOT_ALLOWED",
  "SPACE_MANAGER_REMOVAL_NOT_ALLOWED",
]) {
  test(`${code} 삭제 거절은 자동 재시도 없이 안내하고 최신 목록을 반영한다`, async ({
    page,
  }) => {
    const { control, calls } = await backend(page);
    control.removeError = {
      status: 409,
      code,
      message: "삭제 조건이 변경되었습니다.",
    };
    await page.goto(path);
    const remove = page.getByRole("button", {
      name: "미소속 참여자 참여자 삭제",
      exact: true,
    });
    await remove.click();
    await page
      .getByRole("dialog", { name: "참여자 삭제", exact: true })
      .getByRole("button", { name: "삭제", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "삭제 조건이 변경되었습니다.",
    );
    await expect(remove).toBeDisabled();
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
    await expect(page.getByRole("table")).toContainText("미소속 참여자");
  });
}

test("이미 제거된 대상은 재조회하고 삭제 중 권한 상실 시 기존 명단을 숨긴다", async ({
  page,
}) => {
  const { control, calls } = await backend(page);
  control.removeError = {
    status: 404,
    code: "SPACE_MEMBER_NOT_FOUND",
    message: "이미 삭제된 참여자입니다.",
  };
  await page.goto(path);
  await page
    .getByRole("button", { name: "미소속 참여자 참여자 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "미소속 참여자 참여자 삭제",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("이미 삭제된 참여자");
  control.removeError = {
    status: 403,
    code: "FORBIDDEN",
    message: "관리자 권한이 없습니다.",
  };
  await page
    .getByRole("button", { name: "참여자 참여자 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "관리자 권한이 없습니다.",
  );
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(2);
});

test("저장 실패는 대상을 유지하고 명시적 재시도만 허용하며 중복 클릭을 막는다", async ({
  page,
}) => {
  const { control, calls } = await backend(page);
  control.removeError = {
    status: 503,
    code: "UNAVAILABLE",
    message: "삭제 요청 실패",
  };
  await page.goto(path);
  const remove = page.getByRole("button", {
    name: "미소속 참여자 참여자 삭제",
    exact: true,
  });
  await remove.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("삭제 요청 실패");
  await expect(remove).toBeEnabled();
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
  control.removeError = null;
  control.slow = true;
  await remove.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveCount(0);
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(2);
});

test("미리보기는 서버 호출 없이 참여자를 삭제하고 새로고침 후에도 유지한다", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("fairplay:preview-role", "manager");
    if (!localStorage.getItem("fairplay:mock:v9:preview:1"))
      localStorage.setItem(
        "fairplay:mock:v9:preview:1",
        JSON.stringify({
          teams: {},
          rounds: [],
          scenario: "building",
          spaceOverrides: {
            membershipLockedAt: null,
            teamBuildingStatus: "OPEN",
          },
        }),
      );
  });
  await page.goto(`/preview${path}`);
  const remove = page.getByRole("button", {
    name: "박서연 참여자 삭제",
    exact: true,
  });
  await remove.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(remove).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(remove).toHaveCount(0);
  expect(requests).toHaveLength(0);
});

test("긴 이름·동명이인은 320px에서도 식별할 수 있고 가로 넘침이 없다", async ({
  page,
}) => {
  const { members } = await backend(page);
  members.push(
    member(8, "동명이인"),
    member(9, "동명이인"),
    member(10, "긴이름".repeat(40), {
      team: { teamId: 2, teamName: "긴팀이름".repeat(40), role: "MEMBER" },
    }),
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(path);
  const rows = page.locator(".participant-table tbody tr");
  await expect(rows).toHaveCount(8);
  await expect(
    rows.filter({ hasText: "동명이인" }).locator("small"),
  ).toHaveText(["ID 00000008", "ID 00000009"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("조회 권한을 잃으면 새로고침 후 이전 명단을 노출하지 않는다", async ({
  page,
}) => {
  const { control } = await backend(page);
  await page.goto(path);
  await expect(page.getByRole("table")).toBeVisible();
  control.denied = true;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "관리자 권한이 없습니다.",
  );
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("삭제 응답이 늦게 도착해도 이동한 다른 화면을 되돌리지 않는다", async ({
  page,
}) => {
  const { control, calls } = await backend(page);
  control.slow = true;
  await page.goto(path);
  await page
    .getByRole("button", { name: "미소속 참여자 참여자 삭제", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect
    .poll(() => calls.filter((call) => call.method === "DELETE").length)
    .toBe(1);
  await page
    .getByRole("navigation", { name: "스페이스 메뉴", exact: true })
    .getByRole("button", { name: "스페이스 홈", exact: true })
    .click();
  await expect(page.locator(".space-home")).toBeVisible();
  await expect(page).toHaveURL(/\/spaces\/1$/);
  await expect(page.locator(".space-participants-page")).toHaveCount(0);
});
