import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';
import { addDashboardWidgets } from './helpers/teamDashboard.js';

for (const width of [1440, 390]) {
  test(`헤더 ${width}px: 스페이스만 표시하고 본문에는 팀·메뉴만 표시`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    const header = page.getByLabel('현재 화면 정보');
    await expect(header.locator('strong')).toHaveText('2026 서비스 디자인 프로젝트');
    await expect(header).not.toContainText('삼위일체');
    await expect(header).not.toContainText('작업');
    const breadcrumb = page.locator('.workspace-breadcrumb');
    await expect(breadcrumb.locator('button')).toHaveText('삼위일체');
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('작업');
    await expect(breadcrumb).not.toContainText('2026 서비스 디자인 프로젝트');
    await expect(header).toBeVisible();
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    await expect(header.locator('strong')).toHaveText('2026 서비스 디자인 프로젝트');
    await expect(breadcrumb.locator('button')).toHaveText('삼위일체');
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('산출물');
    await expect(breadcrumb).not.toContainText('2026 서비스 디자인 프로젝트');
    await page.getByRole('button', { name: 'Fairplay', exact: true }).click();
    await expect(header.locator('strong')).toHaveText('내 스페이스');
    await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
    if (!await page.getByLabel('미리보기 역할').isVisible())
      await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
    await selectPreviewOption(page, '미리보기 역할', 'manager');
    await page.goto('/preview/spaces/1/settings');
    await expect(header.locator('strong')).toHaveText('2026 서비스 디자인 프로젝트');
    await expect(header).not.toContainText('삼위일체');
    await expect(breadcrumb.locator('button')).toHaveCount(0);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('스페이스 관리');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1920, 1440, 1100, 1024, 1006, 901, 768, 721]) {
  test(`헤더 ${width}px: 스페이스명은 남은 공간 안에서 표시하고 로고·버튼과 겹치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    const label = page.getByLabel('현재 화면 정보').locator('strong');
    await expect(label).toHaveText('2026 서비스 디자인 프로젝트');
    const bounds = await label.boundingBox();
    const brand = await page.locator('.topbar-brand').boundingBox();
    const profile = await page.locator('.profile-area').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(brand.x + brand.width);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(profile.x);
    const header = page.locator('.topbar');
    const visibleControls = await header.locator('.preview-guide-entry, .preview-toolbar > .preview-toggle, .profile-account-group, .logout-button').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    for (let index = 1; index < visibleControls.length; index++) expect(visibleControls[index].left).toBeGreaterThanOrEqual(visibleControls[index - 1].right);
    await expect(page.getByRole('button', { name: '미리보기 종료', exact: true })).toHaveCSS('white-space', 'nowrap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1440, 1024, 390, 320]) {
  test(`팀 홈 ${width}px: 확인할 작업 버튼의 문구와 건수 줄바꿈 방지`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    await addDashboardWidgets(page, ['지금 확인할 작업']);
    await expect(page.getByRole('heading', { name: '지금 확인할 작업', exact: true })).toBeVisible();
    const buttons = await page.locator('.dashboard-attention button').evaluateAll(elements => elements.map(button => {
      const title = button.children[1];
      const count = button.children[2];
      const parts = [title, count].map(el => el.getBoundingClientRect());
      const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
      return {
        oneLine: title.getBoundingClientRect().height <= lineHeight + 1,
        aligned: parts[1].left >= parts[0].right && Math.max(parts[0].top, parts[1].top) < Math.min(parts[0].bottom, parts[1].bottom),
        fits: button.scrollWidth <= button.clientWidth && title.scrollWidth <= title.clientWidth,
      };
    }));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.oneLine).toBe(true);
      expect(button.aligned).toBe(true);
      expect(button.fits).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1440, 390]) {
  test(`디자인 미리보기: ${width}px에서 흰 배경과 간결한 글씨 유지`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/main');
    await expect(page.getByRole('heading', { name: '내 스페이스', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('body')).toHaveCSS('font-size', '14px');
    await expect(page.getByRole('button', { name: 'Fairplay', exact: true })).toHaveCSS('font-weight', '400');
    const layout = await page.evaluate(() => ({
      heading: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
      overflowing: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(layout.heading).toBeLessThanOrEqual(30);
    expect(layout.overflowing).toBe(false);
  });
}

test('로그인 미리보기에도 흰 배경과 담백한 카드 적용', async ({ page }) => {
  await page.goto('/preview/login');
  await expect(page.getByRole('heading', { name: 'Fairplay', exact: true })).toBeVisible();
  await expect(page.locator('.login-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.login-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.login-page')).toHaveCSS('background-image', 'none');
  await expect(page.locator('.login-card h1')).toHaveCSS('font-weight', '400');
  await expect(page.locator('.login-card h1')).toHaveCSS('font-size', '29px');
  await expect(page.locator('.login-card')).toHaveCSS('box-shadow', 'none');
});

for (const width of [1440, 390]) {
  test(`문서형 워크스페이스 ${width}px: 초록 강조·카드·구분선과 상태색`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(248, 249, 250)');
    await expect(page.locator('.nav-item.active').first()).toHaveCSS('background-color', 'rgb(231, 244, 237)');
    await expect(page.locator('.nav-item.active').first()).toHaveCSS('color', 'rgb(8, 124, 85)');
    await expect(page.locator('.board-task-card').first()).toHaveCSS('border-radius', '6px');
    await expect(page.locator('.board-task-card').first()).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('.task-board-page .primary-button').first()).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    await expect(page.locator('.task-state-in_progress .status-dot')).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    await expect(page.locator('.task-state-revising .status-dot')).toHaveCSS('background-color', 'rgb(234, 179, 8)');
    await expect(page.locator('.task-state-done .status-dot')).toHaveCSS('background-color', 'rgb(148, 163, 184)');
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('desktop-task-board.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
    if (!await page.getByLabel('미리보기 역할').isVisible())
      await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
    await selectPreviewOption(page, '미리보기 역할', 'manager');
    await page.goto('/preview/spaces/1/settings');
    await expect(page.locator('.main-content .panel').first()).toHaveCSS('border-radius', '0px');
    await expect(page.locator('.main-content .panel').first()).toHaveCSS('box-shadow', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1440, 768, 390, 320]) {
  test(`새 레이아웃 ${width}px: 스페이스 목록과 로그인 영역의 반응형 배치`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/main');
    await expect(page.locator('.topbar .brand-logo')).toBeVisible();
    await expect(page.locator('.topbar .brand-logo')).toHaveAttribute('src', '/branding/fairplay-logo.webp');
    await expect(page.locator('.space-list')).toBeVisible();
    await expect(page.getByLabel('스페이스 이름 검색')).toBeVisible();
    await expect(page.getByLabel('내 역할 필터')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.goto('/preview/login');
    await expect(page.getByRole('button', { name: '로그인 없이 사용자 가이드' })).toBeVisible();
    const intro = await page.locator('.login-introduction').boundingBox();
    const actions = await page.locator('.login-actions').boundingBox();
    if (width > 720) {
      expect(Math.abs(intro.y - actions.y)).toBeLessThanOrEqual(1);
      expect(actions.x).toBeGreaterThanOrEqual(intro.x + intro.width - 1);
    } else {
      expect(actions.y).toBeGreaterThanOrEqual(intro.y + intro.height - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1920, 1440, 1280, 1024, 768, 390, 320]) {
  test(`작업 카드 ${width}px: 핵심 정보만 접고 상세를 펼칠 수 있다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await expect(page.locator('.board-task-card')).toHaveCount(6);
    if (width > 720) {
      const columns = await page.locator('.task-column').evaluateAll((elements) => elements.map((el) => {
        const box = el.getBoundingClientRect();
        return { top: box.top, left: box.left, width: box.width };
      }));
      expect(columns).toHaveLength(4);
      const columnsPerRow = width <= 900 ? 2 : 4;
      for (const [index, column] of columns.entries()) {
        expect(Math.abs(column.top - columns[Math.floor(index / columnsPerRow) * columnsPerRow].top)).toBeLessThanOrEqual(1);
        expect(Math.abs(column.width - columns[0].width)).toBeLessThanOrEqual(1);
        if (index % columnsPerRow > 0) expect(column.left).toBeGreaterThan(columns[index - 1].left);
      }
      const board = await page.locator('.task-columns').evaluate(el => ({ width: el.clientWidth, contentWidth: el.scrollWidth }));
      expect(board.contentWidth).toBeLessThanOrEqual(board.width + 1);
    }
    const firstCard = page.locator('.board-task-card').first();
    const foldedHeight = await firstCard.evaluate((card) => card.getBoundingClientRect().height);
    await expect(firstCard.locator('.task-number')).toBeVisible();
    await expect(firstCard.locator('.task-workload-line')).toHaveCount(0);
    await expect(firstCard.locator('.task-card-meta')).toHaveCount(0);
    const overdueCard = page.locator('.board-task-card').filter({
      has: page.locator('.board-card-overdue'),
    }).first();
    await expect(overdueCard.locator('.board-card-overdue')).toBeVisible();
    const overduePosition = await overdueCard.evaluate((card) => {
      const cardBounds = card.getBoundingClientRect();
      const badgeBounds = card.querySelector('.board-card-overdue').getBoundingClientRect();
      return {
        top: badgeBounds.top - cardBounds.top,
        right: cardBounds.right - badgeBounds.right,
      };
    });
    expect(overduePosition.top).toBeLessThanOrEqual(15);
    expect(overduePosition.right).toBeLessThanOrEqual(15);
    await firstCard.getByRole('button', { name: /상세 보기$/ }).click();
    await expect(firstCard.locator('.task-workload-line')).toBeVisible();
    await expect(firstCard.locator('.task-card-meta')).toBeVisible();
    expect(await firstCard.evaluate((card) => card.getBoundingClientRect().height)).toBeGreaterThan(foldedHeight);
    await firstCard.getByRole('button', { name: /상세 접기$/ }).click();
    await expect(firstCard.locator('.task-workload-line')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('상세 작업 카드는 담당자 수에 맞춰 높이를 사용한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/preview/spaces/1/teams/1/tasks');
  const twoAssigneeCard = page.locator('.board-task-card').filter({ hasText: '#102' });
  const oneAssigneeCard = page.locator('.board-task-card').filter({ hasText: '#103' });
  await twoAssigneeCard.getByRole('button', { name: /상세 보기$/ }).click();
  await oneAssigneeCard.getByRole('button', { name: /상세 보기$/ }).click();
  const [twoAssigneeHeight, oneAssigneeHeight] = await Promise.all([
    twoAssigneeCard.evaluate((card) => card.getBoundingClientRect().height),
    oneAssigneeCard.evaluate((card) => card.getBoundingClientRect().height),
  ]);
  expect(twoAssigneeHeight).toBeGreaterThan(oneAssigneeHeight);
});
