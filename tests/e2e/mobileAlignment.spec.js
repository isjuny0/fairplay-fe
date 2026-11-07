import { test, expect } from '@playwright/test';

const space = '/preview/spaces/1';

for (const width of [320, 390, 469, 600, 720]) {
  test(`${width}px: 공지 제목 아래 작성자와 날짜가 한 묶음으로 정렬된다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [space, `${space}/announcements`]) {
      await page.goto(route);
      const rows = page.locator('.announcement-row');
      await expect(rows).toHaveCount(2);
      for (const row of await rows.all()) {
        const title = await row.locator('.announcement-row-copy').boundingBox();
        const meta = await row.locator('.announcement-row-meta').boundingBox();
        const author = await row.locator('.announcement-author').boundingBox();
        const date = await row.locator('time').boundingBox();
        expect(Math.abs(meta.x - title.x)).toBeLessThan(1);
        expect(Math.abs(author.x - title.x)).toBeLessThan(1);
        expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height);
        if (Math.abs(date.y - author.y) < 3) {
          expect(date.x).toBeGreaterThanOrEqual(author.x + author.width);
        } else {
          expect(Math.abs(date.x - title.x)).toBeLessThan(1);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.announcement-board').screenshot({ path: info.outputPath(route === space ? 'home-announcements.png' : 'announcement-list.png') });
    }
  });

  test(`${width}px: 내 팀 카드의 이동 아이콘과 팀 정보가 같은 행에 놓인다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(space);
    const copy = page.locator('.space-home-own-card .space-home-team-copy');
    const indicator = page.locator('.space-home-own-card .space-home-team-indicator');
    await expect(copy).toBeVisible();
    const text = await copy.boundingBox();
    const icon = await indicator.boundingBox();
    expect(icon.x).toBeGreaterThanOrEqual(text.x + text.width);
    expect(icon.y).toBeLessThan(text.y + text.height);
    expect(icon.y + icon.height).toBeGreaterThan(text.y);
    const dates = page.locator('.space-home-dates');
    for (const row of await dates.all()) {
      expect(await row.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    }
  });

  if (width <= 600) {
    test(`${width}px: 스페이스 선택 카드의 역할은 스페이스 이름 아래에 정렬된다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/preview/main');
      const item = page.locator('.space-directory .space-list button').first();
      await expect(item).toBeVisible();
      const title = await item.locator('.directory-space-name').boundingBox();
      const role = await item.locator('.role-badge').boundingBox();
      expect(Math.abs(role.x - title.x)).toBeLessThan(1);
      expect(role.y).toBeGreaterThanOrEqual(title.y + title.height);
    });
  }

  test(`${width}px: 팀 진행률 그래프와 설명이 같은 중심선에 놓인다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${space}/teams/1`);
    const card = page.locator('.dashboard-team-progress');
    await expect(card.locator('.dashboard-progress-copy')).toBeVisible();
    const ring = await card.locator('.dashboard-progress-ring').boundingBox();
    const copy = await card.locator('.dashboard-progress-copy').boundingBox();
    const date = await card.locator('time').boundingBox();
    const cardBox = await card.boundingBox();
    const button = await card.locator('.dashboard-shortcut-button').boundingBox();
    expect(Math.abs(ring.x + ring.width / 2 - copy.x - copy.width / 2)).toBeLessThan(1);
    expect(Math.abs(ring.x + ring.width / 2 - date.x - date.width / 2)).toBeLessThan(1);
    expect(button.y + button.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 10);
  });
}

test('320px: 긴 공지 제목과 작성자도 같은 읽기 흐름으로 줄바꿈한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto(space);
  await expect(page.locator('.announcement-row')).toHaveCount(2);
  await page.evaluate(async () => {
    const { getMockState, saveMockState } = await import('/src/mock/planned.js');
    const { previewContext } = await import('/src/mock/preview.js');
    const context = previewContext();
    const state = getMockState(context);
    state.spaceAnnouncements[0].title = '프로젝트 참여자가 함께 확인해야 하는 새로운 공지사항과 운영 안내';
    state.spaceAnnouncements[0].authorName = '아주 긴 이름을 사용하는 프로젝트 운영 담당자';
    saveMockState(context, state);
  });
  await page.goto(`${space}/announcements`);
  const row = page.locator('.announcement-row').first();
  const title = await row.locator('.announcement-row-copy').boundingBox();
  const meta = await row.locator('.announcement-row-meta').boundingBox();
  expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height);
  expect(await row.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await row.getByRole('button', { name: /프로젝트 참여자가/ }).click();
  await expect(page).toHaveURL(/announcements\/1$/);
});

test('320px: 참여자 관리의 항목과 값은 같은 시작선에서 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'manager'));
  await page.goto(`${space}/participants`);
  const role = page.locator('.participant-table tbody tr').first().locator('[data-label="스페이스 역할"]');
  await expect(role).toHaveCSS('text-align', 'left');
  await page.goto(`${space}/rounds`);
  const steps = page.getByRole('list', { name: '중간 평가 진행 단계', exact: true }).locator('li');
  await expect(steps).toHaveCount(4);
  const boxes = await steps.evaluateAll(elements => elements.map(e => e.getBoundingClientRect().toJSON()));
  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
  expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[0].bottom);
});
