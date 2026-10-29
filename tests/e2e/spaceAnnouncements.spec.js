import { test, expect } from "@playwright/test";

const base = "/api/spaces/1/announcements";
const listPath = "/spaces/1/announcements";
const makeItem = (id) => ({
  id,
  spaceId: 1,
  authorId: "manager",
  authorName: "운영 관리자",
  title: `프로젝트 공지 ${id}`,
  content: `공지 ${id} 본문\n두 번째 줄`,
  pinned: id === 1,
  version: 0,
  createdAt: "2026-10-20T09:00:00",
  updatedAt: "2026-10-20T09:00:00",
});

async function backend(page, { role = "MANAGER", count = 3 } = {}) {
  const items = Array.from({ length: count }, (_, index) =>
    makeItem(index + 1),
  );
  const requests = [];
  const control = {
    denied: false,
    failList: false,
    failWrite: false,
    failNext: false,
    foreign: false,
  };
  let nextId = count + 1;
  const space = {
    id: 1,
    name: "공지 프로젝트",
    myRole: role,
    description: "프로젝트 소개",
    teamBuildingStatus: "CLOSED",
    startAt: "2026-01-01T09:00:00",
    endAt: "2030-12-31T18:00:00",
  };
  const team = {
    id: 1,
    spaceId: 1,
    name: "프로젝트 팀",
    leaderId: "me",
    myMembershipStatus: "APPROVED",
    approvedMemberCount: 2,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method();
    if (!path.startsWith("/api/")) return route.continue();
    requests.push({
      path,
      method,
      query: url.search,
      body: request.postDataJSON(),
      headers: request.headers(),
    });
    const reply = (json, status = 200) => route.fulfill({ json, status });
    const fail = (code, message, status) => reply({ code, message }, status);
    if (path === "/api/me") return reply({ id: "me", name: "현재 사용자" });
    if (path === "/api/auth/csrf")
      return reply({ headerName: "X-CSRF-TOKEN", token: "notice-token" });
    if (path === "/api/spaces") return reply([space]);
    if (path === "/api/spaces/1") return reply(space);
    if (path === "/api/spaces/1/teams") return reply([team]);
    if (path === "/api/teams/1") return reply(team);
    if (path === "/api/teams/1/members")
      return reply([{ userId: "me", name: "현재 사용자", role: "LEADER" }]);
    if (!path.startsWith(base)) return fail("TEST_NOT_FOUND", path, 404);
    if (
      control.denied ||
      !["MANAGER", "USER"].includes(role) ||
      (method !== "GET" && role !== "MANAGER")
    )
      return fail("FORBIDDEN", "스페이스 공지 접근 권한이 없습니다.", 403);
    const itemId = path === base ? null : Number(path.split("/").at(-1));
    const item = items.find((entry) => entry.id === itemId);
    if (itemId != null && !item)
      return fail(
        "ANNOUNCEMENT_NOT_FOUND",
        "삭제되었거나 존재하지 않는 공지입니다.",
        404,
      );
    if (method === "GET") {
      if (itemId != null)
        return reply(control.foreign ? { ...item, spaceId: 99 } : item);
      const number = Number(url.searchParams.get("page") || 0),
        size = Number(url.searchParams.get("size") || 20);
      if (control.failList || (control.failNext && number === 1))
        return fail("UNAVAILABLE", "공지 목록 조회 실패", 503);
      return reply(
        [...items]
          .sort(
            (a, b) =>
              Number(b.pinned) - Number(a.pinned) ||
              b.createdAt.localeCompare(a.createdAt) ||
              b.id - a.id,
          )
          .slice(number * size, (number + 1) * size),
      );
    }
    if (control.failWrite) return fail("UNAVAILABLE", "공지 저장 실패", 503);
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
        "ANNOUNCEMENT_VERSION_CONFLICT",
        "다른 관리자가 공지를 변경했습니다.",
        409,
      );
    if (method === "DELETE") {
      items.splice(items.indexOf(item), 1);
      return route.fulfill({ status: 204 });
    }
    if (method === "POST") {
      const created = {
        ...makeItem(nextId++),
        ...body,
        pinned: body.pinned ?? false,
        authorId: "me",
        authorName: "현재 사용자",
        createdAt: "2026-10-26T14:00:00",
        updatedAt: "2026-10-26T14:00:00",
      };
      items.push(created);
      return reply(created, 201);
    }
    Object.assign(item, {
      title: body.title,
      content: body.content,
      pinned: body.pinned,
      version: item.version + 1,
      updatedAt: "2026-10-26T15:00:00",
    });
    return reply(item);
  });
  return { items, requests, control };
}

async function fillEditor(
  page,
  title = "새 운영 공지",
  content = "모두 확인해 주세요.\n두 번째 줄입니다.",
) {
  const dialog = page.getByRole("dialog", {
    name: /공지 작성|공지 수정/,
    exact: true,
  });
  await dialog.getByLabel("공지 제목", { exact: true }).fill(title);
  await dialog.getByLabel("공지 본문", { exact: true }).fill(content);
  return dialog;
}

test("현재 페이지 검색은 제목·작성자를 찾고 상세 복귀·새로고침에 조건을 유지한다", async ({ page }) => {
  const { requests } = await backend(page, { role: "USER", count: 21 });
  await page.goto(listPath);
  await expect(page.locator('.announcement-row')).toHaveCount(20);
  const search = page.getByRole('searchbox', { name: '현재 페이지 공지 검색', exact: true });
  await search.fill('프로젝트 공지 21');
  await expect(page.locator('.announcement-row')).toHaveCount(20);
  await search.press('Enter');
  await expect(page.locator('.announcement-row')).toHaveCount(1);
  await expect(page.getByRole('status', { name: '공지 검색 결과' })).toHaveCount(0);
  await expect(page.getByText(/현재 페이지 \d+건/)).toHaveCount(0);
  await page.getByRole('button', { name: '프로젝트 공지 21', exact: true }).click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(search).toHaveValue('프로젝트 공지 21');
  await page.reload();
  await expect(page.locator('.announcement-row')).toHaveCount(1);
  await search.fill('운영 관리자');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect(page.locator('.announcement-row')).toHaveCount(20);
  await search.fill('없는 공지');
  await search.press('Enter');
  await expect(page.getByText('현재 페이지에서 일치하는 공지가 없습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '검색 초기화', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.locator('.announcement-row')).toHaveCount(20);
  // Search is deliberately local to a page: no invented server query or write.
  expect(requests.filter(r => r.path === base).every(r => !new URLSearchParams(r.query).has('q'))).toBe(true);
  expect(requests.some(r => r.method !== 'GET')).toBe(false);
});

for (const width of [1440, 320]) {
  test(`${width}px 긴 공지 제목·작성자·본문도 잘리지 않고 화면 밖으로 넘치지 않는다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const { items } = await backend(page, { role: 'USER', count: 3 });
    items[0].title = '프로젝트 발표와 제출 일정 변경 안내 '.repeat(5).slice(0, 100);
    items[0].authorName = '서비스디자인프로젝트 운영 담당 관리자';
    items[0].content = '긴공지본문'.repeat(300) + '\n두 번째 문단입니다.';
    await page.goto(listPath);
    const title = page.getByRole('button', { name: items[0].title, exact: true });
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute('title', items[0].title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.announcement-board').screenshot({ path: testInfo.outputPath('long-announcement-list.png') });
    await title.click();
    await expect(page.locator('.announcement-content')).toHaveText(items[0].content);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  for (const role of ['participant', 'member', 'leader', 'manager']) {
    test(`${width}px ${role}도 같은 공지 게시판·요약·상세 디자인을 사용하고 관리 권한을 유지한다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(role => localStorage.setItem('fairplay:preview-role', role), role);
      await page.goto('/preview/spaces/1/announcements');
      const board = page.locator('.announcement-board');
      await expect(board.locator('.announcement-row')).toHaveCount(2);
      await expect(page.getByRole('searchbox', { name: '현재 페이지 공지 검색' })).toBeVisible();
      await expect(board.locator('.announcement-author').first()).toContainText('정민수');
      await expect(board.locator('.announcement-pin')).toHaveCount(0);
      await expect(board.getByRole('img', { name: '중요 공지', exact: true })).toHaveCount(1);
      for (const row of await board.locator('.announcement-row').all()) {
        await expect(row).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      }
      await expect(page.getByRole('button', { name: '공지 작성', exact: true })).toHaveCount(role === 'manager' ? 1 : 0);
      if (width > 600) {
        await expect(board.locator('.announcement-columns')).toBeVisible();
        await expect(board.locator('.announcement-columns')).toHaveText('구분제목작성자등록일');
        const titleBox = await board.locator('.announcement-row-copy').first().boundingBox();
        const authorBox = await board.locator('.announcement-author').first().boundingBox();
        expect(authorBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
      } else await expect(board.locator('.announcement-columns')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: testInfo.outputPath('announcement-board.png'), animations: 'disabled' });
      await board.getByRole('button', { name: '프로젝트 진행 및 공지 확인 안내', exact: true }).click();
      await expect(page.locator('.announcement-content')).toContainText('프로젝트 공지');
      await expect(page.locator('.announcement-metadata')).toContainText('작성자');
      await expect(page.locator('.announcement-pin')).toHaveText('중요');
      const actions = page.locator('.announcements-page > .page-heading > .heading-actions');
      await expect(actions.getByRole('button')).toHaveCount(2);
      const backBox = await actions.getByRole('button', { name: '← 목록으로', exact: true }).boundingBox();
      const refreshBox = await actions.getByRole('button', { name: '새로고침', exact: true }).boundingBox();
      expect(backBox.x + backBox.width).toBeLessThanOrEqual(refreshBox.x);
      expect(Math.abs(backBox.y + backBox.height / 2 - refreshBox.y - refreshBox.height / 2)).toBeLessThan(1);
      await expect(page.getByRole('button', { name: '공지 수정', exact: true })).toHaveCount(role === 'manager' ? 1 : 0);
      await expect(page.getByRole('button', { name: '공지 삭제', exact: true })).toHaveCount(role === 'manager' ? 1 : 0);
      await page.screenshot({ path: testInfo.outputPath('announcement-detail.png'), animations: 'disabled' });
      await page.goto('/preview/spaces/1');
      await expect(page.locator('.space-announcement-summary .announcement-board.is-compact')).toBeVisible();
      await expect(page.locator('.space-announcement-summary .announcement-author').first()).toContainText('정민수');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test("관리자는 홈 요약에서 공지를 작성하고 일반 텍스트로 조회·수정·삭제한다", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { items, requests } = await backend(page, { count: 4 });
  await page.goto("/spaces/1");
  const summary = page.getByRole("region", { name: "공지사항", exact: true });
  await expect(summary.locator(".announcement-row")).toHaveCount(3);
  await expect(summary.locator(".heading-actions > button")).toHaveText([
    "공지 작성",
    "전체 보기",
  ]);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const createBox = await summary
      .getByRole("button", { name: "공지 작성", exact: true })
      .boundingBox();
    const allBox = await summary
      .getByRole("button", { name: "전체 보기", exact: true })
      .boundingBox();
    expect(createBox.x + createBox.width).toBeLessThanOrEqual(allBox.x);
    expect(createBox.height).toBeLessThanOrEqual(32);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(summary.locator(".announcement-title").first()).toHaveText(
    "프로젝트 공지 1",
  );
  await summary.screenshot({
    path: testInfo.outputPath("space-announcement-summary.png"),
  });
  await summary.getByRole("button", { name: "공지 작성", exact: true }).click();
  let editor = await fillEditor(
    page,
    "  새 운영 공지  ",
    "  <b>일반 텍스트</b>\n**그대로 표시**  ",
  );
  await editor.getByLabel("중요 공지", { exact: true }).check();
  await editor.getByRole("button", { name: "공지 등록", exact: true }).click();
  await expect(page).toHaveURL(/\/announcements\/5$/);
  await expect(page.locator(".announcement-content")).toHaveText(
    "<b>일반 텍스트</b>\n**그대로 표시**",
  );
  await expect(
    page.locator(".announcement-content b, .announcement-content strong"),
  ).toHaveCount(0);
  await expect(page.locator(".announcement-pin")).toHaveText("중요");
  await expect(
    page.locator(".announcement-title-group .announcement-pin"),
  ).toHaveCount(1);
  await expect(
    page.locator(".announcement-detail-heading .announcement-pin"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "새 운영 공지", level: 1, exact: true }),
  ).toBeVisible();
  const editButton = page.getByRole("button", {
    name: "공지 수정",
    exact: true,
  });
  const deleteButton = page.getByRole("button", {
    name: "공지 삭제",
    exact: true,
  });
  await expect(deleteButton).toHaveClass("secondary-button danger");
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const backBox = await page
      .getByRole("button", { name: "← 목록으로", exact: true })
      .boundingBox();
    const refreshBox = await page
      .getByRole("button", { name: "새로고침", exact: true })
      .boundingBox();
    expect(backBox.x + backBox.width).toBeLessThanOrEqual(refreshBox.x);
    expect(
      Math.abs(backBox.y + backBox.height / 2 - refreshBox.y - refreshBox.height / 2),
    ).toBeLessThan(1);
    await expect(page.locator(".page-heading > .heading-actions .announcement-back-button")).toBeVisible();
    const toolbarBox = await page
      .locator(".announcement-detail-toolbar")
      .boundingBox();
    const headingBox = await page
      .locator(".announcements-page > .page-heading")
      .boundingBox();
    expect(headingBox.y - toolbarBox.y - toolbarBox.height).toBeLessThanOrEqual(
      17,
    );
    const editBox = await editButton.boundingBox();
    const deleteBox = await deleteButton.boundingBox();
    expect(Math.abs(editBox.height - deleteBox.height)).toBeLessThan(1);
    expect(Math.abs(editBox.width - deleteBox.width)).toBeLessThan(1);
    const radius = await editButton.evaluate(
      (element) => getComputedStyle(element).borderRadius,
    );
    await expect(deleteButton).toHaveCSS("border-radius", radius);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "공지 수정", exact: true }).click();
  editor = await fillEditor(page, "변경된 운영 공지", "수정 본문");
  await editor.getByLabel("중요 공지", { exact: true }).uncheck();
  await editor
    .getByRole("button", { name: "공지 수정 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "변경된 운영 공지", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".announcement-pin")).toHaveCount(0);
  await expect(page.locator(".announcement-metadata")).toContainText("수정");
  await page.getByRole("button", { name: "공지 삭제", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "공지 삭제",
    exact: true,
  });
  await expect(confirmation).toContainText("복구할 수 없습니다");
  await confirmation.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(page.locator(".announcement-row")).toHaveCount(4);
  expect(items.some((item) => item.id === 5)).toBe(false);
  const create = requests.find((entry) => entry.method === "POST");
  expect(create.body).toEqual({
    title: "새 운영 공지",
    content: "<b>일반 텍스트</b>\n**그대로 표시**",
    pinned: true,
  });
  const update = requests.find((entry) => entry.method === "PATCH");
  expect(update.body).toEqual({
    title: "변경된 운영 공지",
    content: "수정 본문",
    pinned: false,
    expectedVersion: 0,
  });
  const deletion = requests.find((entry) => entry.method === "DELETE");
  expect(deletion.query).toBe("?expectedVersion=1");
  expect(deletion.body).toBeNull();
  for (const request of [create, update, deletion])
    expect(request.headers["x-csrf-token"]).toBe("notice-token");
});

for (const width of [1440, 320]) {
  test(`공지 요약 하단 여백과 목록 제목·새로고침 정렬을 ${width}px에서 유지한다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await backend(page, { role: "USER", count: 2 });
    await page.goto("/spaces/1");
    const summary = page.locator(".space-announcement-summary");
    await expect(summary.locator(".announcement-row")).toHaveCount(2);
    await expect(summary.locator(".announcement-title").first()).toHaveCSS(
      "font-weight",
      "700",
    );
    await expect(summary.locator(".announcement-title").last()).not.toHaveCSS(
      "font-weight",
      "700",
    );
    const bottomGap = await summary.evaluate(
      (element) =>
        element.getBoundingClientRect().bottom -
        element
          .querySelector(".announcement-row:last-child")
          .getBoundingClientRect().bottom,
    );
    expect(bottomGap).toBeLessThanOrEqual(6);
    await summary.screenshot({
      path: testInfo.outputPath("compact-summary.png"),
    });
    await summary
      .getByRole("button", { name: "전체 보기", exact: true })
      .click();
    const heading = page.locator(".announcements-page > .page-heading");
    const titleBox = await heading
      .getByRole("heading", { name: "공지사항", exact: true })
      .boundingBox();
    const refreshBox = await heading
      .getByRole("button", { name: "새로고침", exact: true })
      .boundingBox();
    expect(Math.abs(titleBox.y + titleBox.height / 2 - refreshBox.y - refreshBox.height / 2)).toBeLessThan(1);
    expect(refreshBox.width).toBe(40);
    expect(refreshBox.height).toBe(40);
    await expect(
      heading.getByRole("button", { name: "새로고침", exact: true }),
    ).toHaveText("");
    await heading.screenshot({
      path: testInfo.outputPath("aligned-heading.png"),
    });
    const list = page.locator(".announcements-page > .announcement-board");
    await expect(list.locator(".announcement-row")).toHaveCount(2);
    await expect(list.locator(".announcement-title").first()).toHaveCSS(
      "font-weight",
      "700",
    );
    await expect(list.locator(".announcement-title").last()).not.toHaveCSS(
      "font-weight",
      "700",
    );
    const listBox = await list.boundingBox();
    const headingBox = await heading.boundingBox();
    const searchBox = await page.locator('.announcement-search-toolbar').boundingBox();
    expect(searchBox.y - headingBox.y - headingBox.height).toBeLessThanOrEqual(13);
    expect(listBox.y - searchBox.y - searchBox.height).toBeLessThanOrEqual(13);
    await expect(list.locator(".announcement-row").first()).toHaveCSS(
      "padding-top",
      "12px",
    );
    const paginationBox = await page
      .locator(".announcement-pagination")
      .boundingBox();
    expect(paginationBox.y - listBox.y - listBox.height).toBeLessThanOrEqual(17);
    await page
      .locator(".announcements-page")
      .screenshot({ path: testInfo.outputPath("compact-list.png") });
  });

  test(`USER·팀 리더는 ${width}px에서 공지를 읽고 관리 버튼 없이 목록으로 돌아간다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { requests } = await backend(page, { role: "USER" });
    await page.goto("/spaces/1");
    const summary = page.getByRole("region", { name: "공지사항", exact: true });
    await expect(
      summary.getByRole("button", { name: "공지 작성", exact: true }),
    ).toHaveCount(0);
    await summary
      .getByRole("button", { name: "전체 보기", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "공지 작성", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "프로젝트 공지 1", exact: true })
      .click();
    await expect(page.locator(".announcement-content")).toHaveText(
      "공지 1 본문\n두 번째 줄",
    );
    const primaryTextColor = await page.locator(".announcements-page h1").evaluate(
      (element) => getComputedStyle(element).color,
    );
    await expect(page.locator(".announcement-content")).toHaveCSS("color", primaryTextColor);
    const breadcrumb = page.getByRole("navigation", {
      name: "현재 위치",
      exact: true,
    });
    await expect(breadcrumb).toHaveCount(1);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(
      "프로젝트 공지 1",
    );
    await expect(
      page.getByRole("heading", {
        name: "프로젝트 공지 1",
        level: 1,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "공지 상세", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".announcement-detail h2")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "공지 수정", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "공지 삭제", exact: true }),
    ).toHaveCount(0);
    await page
      .locator(".announcements-page")
      .screenshot({ path: testInfo.outputPath("announcement-detail.png") });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await breadcrumb
      .getByRole("button", { name: "공지사항", exact: true })
      .click();
    await expect(page.locator(".announcement-row")).toHaveCount(3);
    expect(
      requests.some((entry) =>
        ["POST", "PATCH", "DELETE"].includes(entry.method),
      ),
    ).toBe(false);
    if (width <= 720)
      await page
        .getByRole("button", { name: "스페이스 메뉴 펼치기", exact: true })
        .click();
    await expect(
      page
        .getByRole("navigation", { name: "스페이스 메뉴", exact: true })
        .getByRole("button", { name: "공지사항", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });
}

test("고정 우선 목록의 페이지를 복원하고 마지막 공지 삭제 시 이전 페이지로 돌아간다", async ({
  page,
}) => {
  await backend(page, { count: 21 });
  await page.goto(listPath);
  await expect(page.locator(".announcement-row")).toHaveCount(20);
  await expect(page.locator(".announcement-title").first()).toHaveText(
    "프로젝트 공지 1",
  );
  const pagination = page.getByRole("navigation", {
    name: "공지 목록 페이지",
    exact: true,
  });
  await pagination.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/\?page=1$/);
  await expect(page.locator(".announcement-row")).toHaveCount(1);
  await page.reload();
  await expect(pagination).toContainText("2페이지");
  await page.locator(".announcement-title").click();
  await expect(page).toHaveURL(/\/announcements\/2\?page=1$/);
  await page
    .getByRole("navigation", { name: "현재 위치", exact: true })
    .getByRole("button", { name: "공지사항", exact: true })
    .click();
  await expect(pagination).toContainText("2페이지");
  await page.locator(".announcement-title").click();
  await page.getByRole("button", { name: "공지 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "공지 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(page.locator(".announcement-row")).toHaveCount(20);
  await expect(
    pagination.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
});

test("수정 충돌은 입력을 보존하고 최신 비교와 확인 뒤 새 버전으로만 저장한다", async ({
  page,
}) => {
  const { items, requests } = await backend(page);
  await page.goto(`${listPath}/1`);
  await page.getByRole("button", { name: "공지 수정", exact: true }).click();
  const editor = await fillEditor(page, "내 수정 제목", "내가 작성한 본문");
  items[0].title = "다른 관리자의 제목";
  items[0].content = "다른 관리자의 본문";
  items[0].version = 1;
  const save = editor.getByRole("button", {
    name: "공지 수정 저장",
    exact: true,
  });
  await save.click();
  await expect(editor.getByRole("alert")).toContainText("다른 관리자");
  await expect(editor.getByLabel("공지 제목", { exact: true })).toHaveValue(
    "내 수정 제목",
  );
  await expect(save).toBeDisabled();
  expect(requests.filter((entry) => entry.method === "PATCH")).toHaveLength(1);
  await editor
    .getByRole("button", { name: "최신 내용 확인", exact: true })
    .click();
  await expect(
    editor.getByRole("region", { name: "저장 실패 복구" }),
  ).toContainText("다른 관리자의 제목");
  await expect(editor.getByLabel("공지 본문", { exact: true })).toHaveValue(
    "내가 작성한 본문",
  );
  await save.click();
  await page
    .getByRole("dialog", { name: "최신 내용에 내 수정 반영", exact: true })
    .getByRole("button", { name: "내 내용으로 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "내 수정 제목", exact: true }),
  ).toBeVisible();
  const writes = requests.filter((entry) => entry.method === "PATCH");
  expect(writes).toHaveLength(2);
  expect(writes[1].body.expectedVersion).toBe(1);
});

test("삭제 충돌은 자동 재삭제하지 않고 최신 내용을 보여 준 뒤 다시 확인받는다", async ({
  page,
}) => {
  const { items, requests } = await backend(page);
  await page.goto(`${listPath}/1`);
  await expect(
    page.getByRole("heading", { name: "프로젝트 공지 1", exact: true }),
  ).toBeVisible();
  items[0].title = "삭제 전 다시 확인할 제목";
  items[0].version = 1;
  await page.getByRole("button", { name: "공지 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "공지 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "삭제 전 다시 확인할 제목",
      exact: true,
    }),
  ).toBeVisible();
  expect(requests.filter((entry) => entry.method === "DELETE")).toHaveLength(1);
  await page.getByRole("button", { name: "공지 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "공지 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page).toHaveURL(/\/announcements$/);
  expect(requests.filter((entry) => entry.method === "DELETE")[1].query).toBe(
    "?expectedVersion=1",
  );
});

test("공백 검증·저장 실패·미저장 닫기는 입력을 보존하고 명시적으로 재시도한다", async ({
  page,
}) => {
  const { control, requests } = await backend(page);
  await page.goto(listPath);
  await page.getByRole("button", { name: "공지 작성", exact: true }).click();
  const editor = await fillEditor(page, "   ", "본문");
  await expect(editor.getByLabel("공지 제목", { exact: true })).toHaveAttribute(
    "maxlength",
    "100",
  );
  await expect(editor.getByLabel("공지 본문", { exact: true })).toHaveAttribute(
    "maxlength",
    "5000",
  );
  await editor.getByRole("button", { name: "공지 등록", exact: true }).click();
  await expect(editor.getByLabel("공지 제목", { exact: true })).toBeFocused();
  expect(requests.some((entry) => entry.method === "POST")).toBe(false);
  await editor.getByLabel("공지 제목", { exact: true }).fill("입력 보존 공지");
  control.failWrite = true;
  await editor.getByRole("button", { name: "공지 등록", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("공지 저장 실패");
  await expect(editor.getByLabel("공지 제목", { exact: true })).toHaveValue(
    "입력 보존 공지",
  );
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  const discard = page.getByRole("dialog", {
    name: "입력 내용 버리기",
    exact: true,
  });
  await discard.getByRole("button", { name: "취소", exact: true }).click();
  await expect(editor.getByLabel("공지 본문", { exact: true })).toHaveValue(
    "본문",
  );
  control.failWrite = false;
  await editor.getByRole("button", { name: "공지 등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "입력 보존 공지", exact: true }),
  ).toBeVisible();
  expect(requests.filter((entry) => entry.method === "POST")).toHaveLength(2);
});

test("작성 중 권한 오류는 입력을 보존하고 변경 요청을 다시 보내지 않는다", async ({
  page,
}) => {
  const { control, requests } = await backend(page);
  await page.goto(listPath);
  await page.getByRole("button", { name: "공지 작성", exact: true }).click();
  const editor = await fillEditor(
    page,
    "권한 변경 전에 작성한 공지",
    "입력 내용 보존",
  );
  control.denied = true;
  await editor.getByRole("button", { name: "공지 등록", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("접근 권한");
  await expect(editor.getByLabel("공지 제목", { exact: true })).toHaveValue(
    "권한 변경 전에 작성한 공지",
  );
  await expect(
    editor.getByRole("button", { name: "공지 등록", exact: true }),
  ).toBeDisabled();
  await editor.getByLabel("공지 제목", { exact: true }).press("Enter");
  expect(requests.filter((entry) => entry.method === "POST")).toHaveLength(1);
});

test("조회 권한이 없으면 공지 내용과 관리 버튼을 표시하지 않는다", async ({
  page,
}) => {
  await backend(page, { role: "PENDING" });
  await page.goto(listPath);
  await expect(page.getByRole("alert")).toContainText("접근 권한");
  await expect(page.locator(".announcement-row")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "공지 작성", exact: true }),
  ).toHaveCount(0);
});

test("삭제된 공지·다른 스페이스 응답을 노출하지 않고 목록 복귀를 제공한다", async ({
  page,
}) => {
  const { control } = await backend(page);
  await page.goto(`${listPath}/99`);
  await expect(page.getByRole("alert")).toContainText("존재하지 않는");
  await expect(
    page.getByRole("button", { name: "← 목록으로", exact: true }),
  ).toBeVisible();
  control.foreign = true;
  await page.goto(`${listPath}/1`);
  await expect(page.getByRole("alert")).toContainText(
    "이 스페이스의 공지가 아닙니다",
  );
  await expect(page.locator(".announcement-content")).toHaveCount(0);
});

test("권한 변경과 다음 페이지 조회 실패를 기존 데이터와 구분한다", async ({
  page,
}) => {
  const { control } = await backend(page, { count: 20 });
  control.failNext = true;
  await page.goto(listPath);
  await expect(page.locator(".announcement-row")).toHaveCount(20);
  await expect(page.getByRole("alert")).toContainText("목록 조회 실패");
  control.failNext = false;
  await page
    .getByRole("button", { name: "다시 불러오기", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
  control.denied = true;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("접근 권한");
  await expect(page.locator(".announcement-row")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "공지 작성", exact: true }),
  ).toHaveCount(0);
});

test("공지 요약 오류는 스페이스 홈을 가리지 않고 빈 목록과 구분한다", async ({
  page,
}) => {
  const { control } = await backend(page, { count: 0 });
  control.failList = true;
  await page.goto("/spaces/1");
  const summary = page.getByRole("region", { name: "공지사항", exact: true });
  await expect(summary.getByRole("alert")).toContainText("목록 조회 실패");
  await expect(
    page.getByRole("heading", { name: "내 팀", exact: true }),
  ).toBeVisible();
  control.failList = false;
  await summary
    .getByRole("button", { name: "다시 불러오기", exact: true })
    .click();
  await expect(summary).toContainText("등록된 공지사항이 없습니다.");
});

test("잘못된 ID는 요청하지 않고 잘못된 페이지와 범위 밖 페이지는 첫 페이지로 복구한다", async ({
  page,
}) => {
  const { requests } = await backend(page);
  await page.goto(`${listPath}/0`);
  await expect(page.locator(".announcement-content")).toHaveCount(0);
  expect(requests.some((entry) => entry.path.startsWith(base))).toBe(false);
  await page.goto(`${listPath}?page=abc`);
  await expect(
    page.getByRole("navigation", { name: "공지 목록 페이지" }),
  ).toContainText("1페이지");
  await page.goto(`${listPath}?page=100000`);
  await expect(page).toHaveURL(/\/announcements$/);
  await expect(page.locator(".announcement-row")).toHaveCount(3);
});

test("모바일 작성 창은 긴 입력과 키보드 초점을 유지하고 버린 입력은 저장하지 않는다", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const { requests } = await backend(page, { count: 0 });
  await page.goto(listPath);
  await page.getByRole("button", { name: "공지 작성", exact: true }).click();
  const editor = await fillEditor(page, "제".repeat(100), "내".repeat(5000));
  await expect(editor.getByLabel("공지 제목", { exact: true })).toHaveValue(
    "제".repeat(100),
  );
  await expect(editor.getByLabel("공지 본문", { exact: true })).toHaveValue(
    "내".repeat(5000),
  );
  await expect(editor).toContainText("5,000 / 5,000자");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await editor.screenshot({
    path: testInfo.outputPath("announcement-mobile-editor.png"),
  });
  await editor.getByRole("button", { name: "닫기", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    editor.getByRole("button", { name: "공지 등록", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "입력 내용 버리기", exact: true })
    .getByRole("button", { name: "버리고 닫기", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(requests.some((entry) => entry.method === "POST")).toBe(false);
});

test("미리보기에서 관리자 CRUD를 새로고침 후에도 유지하고 서버에 요청하지 않는다", async ({
  page,
}) => {
  const apiRequests = [];
  await page.route("**/api/**", (route) => {
    if (!new URL(route.request().url()).pathname.startsWith("/api/"))
      return route.continue();
    apiRequests.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem("fairplay:preview-role", "manager"),
  );
  await page.goto(`/preview${listPath}`);
  await page.getByRole("button", { name: "공지 작성", exact: true }).click();
  const editor = await fillEditor(
    page,
    "미리보기 공지",
    "예시 데이터에서만 저장됩니다.",
  );
  await editor.getByRole("button", { name: "공지 등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "미리보기 공지", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "미리보기 공지", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "공지 수정", exact: true }).click();
  await fillEditor(page, "수정한 미리보기 공지", "예시 수정 본문");
  await page
    .getByRole("button", { name: "공지 수정 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "수정한 미리보기 공지", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "공지 삭제", exact: true }).click();
  await page
    .getByRole("dialog", { name: "공지 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.locator(".announcement-row")).toHaveCount(2);
  expect(apiRequests).toEqual([]);
});
