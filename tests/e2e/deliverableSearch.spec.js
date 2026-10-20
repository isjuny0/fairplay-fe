import { test, expect } from "@playwright/test";
import {
  user,
  members,
  space,
  team,
  tasks,
  deliverables,
} from "./helpers/deliverableSearchFixtures.js";
import { searchPreviewDeliverables } from "../../src/mock/deliverableSearch.js";

async function fixture(page) {
  const state = { paused: false, release: null, error: null, queries: [] };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const send = (json, status = 200) => route.fulfill({ json, status });
    if (path === "/api/me") return send(user);
    if (path === "/api/spaces") return send([space]);
    if (path === "/api/spaces/1") return send(space);
    if (path === "/api/spaces/1/teams") return send([team]);
    if (path === "/api/teams/1") return send(team);
    if (path === "/api/teams/1/members") return send(members);
    if (path === "/api/teams/1/tasks") return send(tasks);
    if (path === "/api/teams/1/deletion-request")
      return send({ code: "TEAM_DELETION_REQUEST_NOT_FOUND" }, 404);
    if (path === "/api/teams/1/deliverables") {
      state.queries.push(url.searchParams);
      if (state.paused)
        await new Promise((resolve) => {
          state.release = resolve;
        });
      if (state.error)
        return send(
          {
            code: "FIXTURE_ERROR",
            message: "산출물 검색을 처리하지 못했습니다.",
          },
          state.error,
        );
      return send(searchPreviewDeliverables(deliverables, url.searchParams));
    }
    if (path === "/api/tasks/10")
      return send({ task: tasks[0], contributions: [] });
    if (path.endsWith("/ai-review"))
      return send({ code: "AI_REVIEW_NOT_FOUND" }, 404);
    return send({ message: path }, 501);
  });
  return state;
}
const rows = (page) =>
  page
    .getByRole("region", { name: "산출물 목록", exact: true })
    .locator("tbody tr");

test("다른 페이지의 원본 파일명을 서버 검색으로 찾아 조건과 상세를 유지한다", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/spaces/1/teams/1/deliverables?page=1");
  await expect(rows(page)).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "오래된 정책 원본", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("산출물 검색", { exact: true }).fill("policy");
  await page.getByLabel("산출물 검색", { exact: true }).press("Enter");
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText("1 페이지", { exact: true })).toBeVisible();
  await page.getByLabel("작업별 조회").selectOption("COMMON");
  await page.getByLabel("산출물 유형").selectOption("FILE");
  await page.getByLabel("산출물 분류").selectOption("POLICY");
  await page.getByLabel("산출물 등록자").selectOption(members[0].userId);
  await page.getByLabel("산출물 정렬").selectOption("TITLE_ASC");
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel("산출물 검색", { exact: true })).toHaveValue(
    "policy",
  );
  await expect(page.getByLabel("작업별 조회")).toHaveValue("COMMON");
  await expect(page.getByLabel("산출물 유형")).toHaveValue("FILE");
  await expect(page.getByLabel("산출물 분류")).toHaveValue("POLICY");
  await expect(page.getByLabel("산출물 등록자")).toHaveValue(members[0].userId);
  await expect(page.getByLabel("산출물 정렬")).toHaveValue("TITLE_ASC");
  await page
    .getByRole("button", { name: "오래된 정책 원본", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Policy_100%_final.md");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .last()
    .click();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "조회 조건 초기화" }).click();
  await expect(rows(page)).toHaveCount(20);
  expect(new URL(page.url()).search).toBe("");
});

test("적용된 조건을 개별 해제해도 다른 조건·정렬을 유지하고 입력으로 초점을 돌린다", async ({
  page,
}) => {
  await fixture(page);
  const query = new URLSearchParams({
    q: "policy",
    unlinkedOnly: "true",
    type: "FILE",
    category: "POLICY",
    authorId: members[0].userId,
    sort: "TITLE_ASC",
  });
  await page.goto(`/spaces/1/teams/1/deliverables?${query}`);
  await expect(rows(page)).toHaveCount(1);
  const filters = page.getByRole("group", { name: "적용된 조회 조건" });
  await expect(filters.getByRole("button")).toHaveCount(6);
  const steps = [
    ["검색: policy 조건 해제", "산출물 검색", "q"],
    ["작업: 팀 공용 조건 해제", "작업별 조회", "unlinkedOnly"],
    ["유형: 파일 조건 해제", "산출물 유형", "type"],
    ["분류: 정책 조건 해제", "산출물 분류", "category"],
    [`등록자: ${members[0].name} 조건 해제`, "산출물 등록자", "authorId"],
  ];
  for (const [button, control, key] of steps) {
    const focused = page.getByLabel(control, { exact: true });
    await filters.getByRole("button", { name: button, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(focused).toBeFocused();
    await expect
      .poll(() => new URL(page.url()).searchParams.has(key))
      .toBe(false);
    expect(new URL(page.url()).searchParams.get("sort")).toBe("TITLE_ASC");
    await expect(page.getByText("1 페이지", { exact: true })).toBeVisible();
  }
  await expect(filters.getByRole("button")).toHaveCount(1);
  await filters.getByRole("button", { name: "정렬: 이름 순 조건 해제", exact: true }).click();
  await expect(page.getByLabel("산출물 정렬", { exact: true })).toBeFocused();
  await expect(page.getByLabel("산출물 정렬", { exact: true })).toHaveValue("");
  await expect(filters).toHaveCount(0);
  await expect(rows(page)).toHaveCount(20);
  await expect(page.getByLabel("산출물 검색", { exact: true })).toHaveValue("");
  await page.getByLabel("산출물 분류", { exact: true }).selectOption("POLICY");
  await page.getByRole("button", { name: "조회 조건 초기화" }).click();
  await expect(page.getByLabel("산출물 검색", { exact: true })).toBeFocused();
  expect(new URL(page.url()).search).toBe("");
});

test("서버 정렬·필터 후 페이지를 이동하고 조건 변경은 첫 페이지로 돌아간다", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/spaces/1/teams/1/deliverables");
  await expect(rows(page).first()).toContainText("산출물 45");
  await page.getByLabel("산출물 정렬").selectOption("UPDATED_DESC");
  await expect(rows(page).first()).toContainText("오래된 정책 원본");
  await page.getByLabel("산출물 분류").selectOption("DESIGN");
  await expect(rows(page)).toHaveCount(20);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("작업별 조회").selectOption("10");
  await expect(page.getByText("1 페이지", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(11);
  await page.goBack();
  await expect(page.getByText("2 페이지", { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
});

test("검색 지연·오류와 빈 결과를 구분하고 오류에서도 조회 조건을 초기화한다", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/spaces/1/teams/1/deliverables");
  await expect(rows(page)).toHaveCount(20);
  state.paused = true;
  await page.getByLabel("산출물 유형").selectOption("TEXT");
  await expect(
    page.getByRole("status", { name: "산출물 목록 불러오는 중" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "산출물 목록", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => Boolean(state.release)).toBe(true);
  state.paused = false;
  state.error = 503;
  state.release();
  await expect(page.getByRole("alert")).toContainText(
    "산출물 검색을 처리하지 못했습니다.",
  );
  await expect(page.getByText("조건에 맞는 산출물이 없습니다.")).toHaveCount(0);
  state.error = null;
  await page.getByRole("button", { name: "조회 조건 초기화" }).click();
  await expect(rows(page)).toHaveCount(20);
  await page.getByLabel("산출물 검색", { exact: true }).fill("없는 문서");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByText("조건에 맞는 산출물이 없습니다.")).toBeVisible();
});

test("작업 상세는 상위 작업 검색어·정렬·담당 조건을 산출물 검색에 사용하지 않는다", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(
    "/spaces/1/teams/1/tasks/10?q=산출물과무관&sort=start&type=TEXT&authorId=unknown",
  );
  await expect(
    page.getByRole("heading", { name: tasks[0].title, level: 1 }),
  ).toBeVisible();
  await expect.poll(() => state.queries.length).toBeGreaterThan(0);
  expect(state.queries.at(-1).get("taskId")).toBe("10");
  for (const key of ["q", "sort", "type", "authorId"])
    expect(state.queries.at(-1).has(key)).toBe(false);
  await expect(
    page.getByRole("searchbox", { name: "산출물 검색" }),
  ).toHaveCount(0);
});

test("웹과 좁은 화면에서 모든 탐색 제어를 사용할 수 있고 페이지 밖으로 넘치지 않는다", async ({
  page,
}) => {
  await fixture(page);
  for (const width of [1440, 1280, 1024, 320]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/spaces/1/teams/1/deliverables");
    await expect(rows(page)).toHaveCount(20);
    for (const label of [
      "산출물 유형",
      "산출물 분류",
      "산출물 등록자",
      "산출물 정렬",
    ])
      await expect(page.getByLabel(label)).toBeEnabled();
    expect(
      await page
        .getByRole("button", { name: "검색", exact: true })
        .evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width >= 1280) {
      const table = page.getByRole("region", {
        name: "산출물 목록",
        exact: true,
      });
      expect(
        await table.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
    }
  }
});

test("로그인 없는 미리보기에서도 유형과 검색 조건을 적용하고 초기화한다", async ({
  page,
}) => {
  await page.goto("/preview/spaces/1/teams/1/deliverables");
  await expect(rows(page).first()).toBeVisible();
  await page.getByLabel("산출물 유형").selectOption("TEXT");
  await expect(rows(page).first()).toBeVisible();
  const firstTitle = await rows(page)
    .first()
    .getByRole("button")
    .first()
    .innerText();
  await page.getByLabel("산출물 검색", { exact: true }).fill(firstTitle);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page
    .getByLabel("산출물 검색", { exact: true })
    .fill("존재하지 않는 미리보기 자료");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByText("조건에 맞는 산출물이 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "조회 조건 초기화" }).click();
  await expect(rows(page).first()).toBeVisible();
});
