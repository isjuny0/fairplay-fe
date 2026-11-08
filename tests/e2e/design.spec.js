import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';
import { addDashboardWidgets } from './helpers/teamDashboard.js';

for (const width of [1440, 390]) {
  test(`헤더 ${width}px: 스페이스만 표시하고 본문에는 팀·메뉴만 표시`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    const header = page.getByLabel('현재 화면 정보');
    await expect(header.locator('strong')).toHaveText('2026 캡스톤디자인');
    await expect(header).not.toContainText('삼위일체');
    await expect(header).not.toContainText('작업');
    const breadcrumb = page.locator('.workspace-breadcrumb');
    await expect(breadcrumb.locator('button')).toHaveText('삼위일체');
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('작업');
    await expect(breadcrumb).not.toContainText('2026 캡스톤디자인');
    await expect(header).toBeVisible();
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    await expect(header.locator('strong')).toHaveText('2026 캡스톤디자인');
    await expect(breadcrumb.locator('button')).toHaveText('삼위일체');
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('팀 자료');
    await expect(breadcrumb).not.toContainText('2026 캡스톤디자인');
    await page.getByRole('button', { name: 'Fairplay', exact: true }).click();
    await expect(header.locator('strong')).toHaveText('내 스페이스');
    await expect(page.getByRole('heading', { name: '내 스페이스', exact: true })).toBeFocused();
    await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
    if (!await page.getByLabel('미리보기 역할').isVisible())
      await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
    await selectPreviewOption(page, '미리보기 역할', 'manager');
    await page.goto('/preview/spaces/1/settings');
    await expect(header.locator('strong')).toHaveText('2026 캡스톤디자인');
    await expect(header).not.toContainText('삼위일체');
    await expect(breadcrumb.locator('button')).toHaveCount(0);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('스페이스 관리');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [3840, 1920, 1440, 1100, 1024, 1006, 901, 768, 721]) {
  test(`헤더 ${width}px: 스페이스 정보를 화면 중앙에 표시하고 로고·버튼과 겹치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    const label = page.getByLabel('현재 화면 정보').locator('strong');
    await expect(label).toHaveText('2026 캡스톤디자인');
    const bounds = await label.boundingBox();
    const brand = await page.locator('.topbar-brand').boundingBox();
    const profile = await page.locator('.profile-area').boundingBox();
    const header = await page.locator('.topbar').boundingBox();
    const context = await page.getByLabel('현재 화면 정보').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(brand.x + brand.width);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(profile.x);
    expect(Math.abs(context.x + context.width / 2 - header.x - header.width / 2)).toBeLessThan(1);
    const topbar = page.locator('.topbar');
    const visibleControls = await topbar.locator('.preview-guide-entry, .preview-toolbar > .preview-toggle, .profile-account-group, .logout-button').evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    for (let index = 1; index < visibleControls.length; index++) expect(visibleControls[index].left).toBeGreaterThanOrEqual(visibleControls[index - 1].right);
    await expect(page.locator('.profile-area > .logout-button')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1440, 1024, 390, 320]) {
  test(`팀 홈 ${width}px: 확인할 작업 버튼의 제목과 건수는 위아래로 표시된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    await addDashboardWidgets(page, ['지금 확인할 작업']);
    await expect(page.getByRole('heading', { name: '지금 확인할 작업', exact: true })).toBeVisible();
    const buttons = await page.locator('.dashboard-attention button').evaluateAll(elements => elements.map(button => {
      const title = button.children[1];
      const count = button.children[2];
      const titleBounds = title.getBoundingClientRect();
      const countBounds = count.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(title).lineHeight);
      return {
        oneLine: titleBounds.height <= lineHeight + 1,
        stacked: countBounds.top >= titleBounds.bottom,
        fits: button.scrollWidth <= button.clientWidth && title.scrollWidth <= title.clientWidth && count.scrollWidth <= count.clientWidth,
      };
    }));
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.oneLine).toBe(true);
      expect(button.stacked).toBe(true);
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
  await expect(page.getByRole('heading', { name: 'Fairplay에 로그인', exact: true })).toBeVisible();
  await expect(page.locator('.login-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.login-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.login-page')).toHaveCSS('background-image', 'none');
  await expect(page.locator('.login-card-heading h1')).toHaveCSS('font-weight', '600');
  await expect(page.locator('.login-card-heading h1')).toHaveCSS('font-size', '24px');
  await expect(page.locator('.login-card')).toHaveCSS('box-shadow', 'none');
});

for (const width of [1440, 320]) {
  test(`실제 로그인 ${width}px: 작은 카드에 로그인 제목과 짧은 안내를 표시한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/me', (route) => route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }));
    await page.goto('/login');
    const card = page.locator('.login-card--compact');
    const shell = page.locator('.login-shell');
    await expect(shell.getByRole('img', { name: 'Fairplay', exact: true })).toBeVisible();
    await expect(shell.locator('.login-art')).toHaveAttribute('aria-hidden', 'true');
    await expect(shell.locator('.login-art-card')).toHaveCount(3);
    await expect(shell.locator('.login-art-card--team')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Google로 계속하기', exact: true })).toBeEnabled();
    await expect(card.locator('.login-description, ol')).toHaveCount(0);
    await expect(shell.getByRole('heading', { name: 'Fairplay에 로그인', exact: true })).toBeVisible();
    await expect(shell.locator('.login-card-heading p')).toHaveText('Google 계정으로 간편하게 시작하세요.');
    await expect(card.getByRole('button')).toHaveCSS('border-top-color', 'rgb(116, 119, 117)');
    await expect(card.getByRole('button')).toHaveCSS('font-weight', '500');
    // Authentication/session notices remain available; only promotional copy is removed.
    await expect(card.locator('.login-actions > p:not([role="status"])')).toHaveCount(0);
    const box = await card.boundingBox();
    expect(box.width).toBeLessThanOrEqual(400);
    expect(box.height).toBeLessThan(200);
    const shellBox = await shell.boundingBox();
    expect(shellBox.width).toBeLessThanOrEqual(400);
    expect(shellBox.height).toBeLessThan(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('compact-login-page.png') });
    await shell.screenshot({ path: testInfo.outputPath('compact-login-card.png') });
    await shell.getByRole('button', { name: '← Fairplay 소개로', exact: true }).click();
    await expect(page).toHaveURL('/');
  });
}

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
  test(`새 레이아웃 ${width}px: 스페이스 목록과 간결한 로그인 카드`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/main');
    await expect(page.locator('.topbar .brand-logo')).toBeVisible();
    await expect(page.locator('.topbar .brand-logo')).toHaveAttribute('src', '/branding/fairplay-logo.webp');
    await expect(page.locator('.space-list')).toBeVisible();
    await expect(page.getByLabel('스페이스 이름 검색')).toBeVisible();
    await expect(page.getByLabel('내 역할 필터')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.goto('/preview/login');
    await expect(page.getByRole('button', { name: 'Google 로그인 · 실제 서비스에서 연결' })).toBeVisible();
    const card = page.locator('.login-card');
    await expect(card.locator('.login-introduction, .login-description, .login-benefits')).toHaveCount(0);
    const shell = page.locator('.login-shell');
    await expect(shell.getByRole('heading', { name: 'Fairplay에 로그인', exact: true })).toBeVisible();
    await expect(shell.locator('.login-card-heading p')).toHaveText('Google 계정으로 간편하게 시작하세요.');
    const box = await card.boundingBox();
    expect(box.width).toBeLessThanOrEqual(400);
    expect(box.height).toBeLessThan(200);
    const logo = await shell.locator('.brand-logo').boundingBox();
    const button = await card.getByRole('button').boundingBox();
    expect(button.y).toBeGreaterThan(logo.y + logo.height);
    expect(Math.abs(logo.x + logo.width / 2 - box.x - box.width / 2)).toBeLessThan(1);
    await page.screenshot({ path: testInfo.outputPath('compact-login.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1920, 1440, 1280, 1024, 768, 390, 320]) {
  test(`작업 카드 ${width}px: 담당자·마감·예상 작업량을 바로 확인한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/spaces/1/teams/1/tasks?view=board');
    const cards = page.locator('.board-task-card');
    await expect(cards.first()).toBeVisible();
    await expect(page.locator('.list-summary')).toHaveCount(0);
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
    const firstCard = cards.first();
    await expect(firstCard.locator('.task-number')).toHaveCount(0);
    await expect(firstCard.locator('.board-card-assignees')).toBeVisible();
    const deadline = firstCard.locator('.task-deadline time');
    await expect(deadline).toHaveText(/\d+월 \d+일 마감$/);
    await expect(deadline).toHaveAttribute('title', /마감 .*\d{2}:\d{2}/);
    await expect(deadline).not.toHaveText(/\d{2}:\d{2}/);
    await expect(cards.locator('.task-workload-line')).toHaveCount(await cards.count());
    await expect(firstCard.locator('.task-workload-line')).toBeVisible();
    await expect(firstCard.locator('.task-workload-line')).toContainText(/예상 작업량: \d+시간/);
    await expect(cards.locator('.task-card-meta')).toHaveCount(0);
    await expect(cards.getByRole('button', { name: /작업량·담당 비율/ })).toHaveCount(0);
    const overdueCard = page.locator('.board-task-card').filter({
      has: page.locator('.board-card-overdue'),
    }).first();
    const overdueDeadline = overdueCard.locator('.task-deadline');
    await expect(overdueDeadline.locator('.board-card-overdue')).toHaveText('지연');
    await expect(overdueCard.locator('.board-card-assignees .board-card-self')).toHaveText('김준영');
    await expect(overdueCard.locator('.board-card-top')).not.toContainText('지연');
    await expect(firstCard.locator('.task-title-button > svg')).toHaveCount(0);
    const taskTitle = await firstCard.locator('h3').innerText();
    await firstCard.click({ position: { x: 4, y: 4 } });
    await expect(page.getByRole('heading', { name: taskTitle, exact: true, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
