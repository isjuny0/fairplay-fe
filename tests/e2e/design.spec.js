import { test, expect } from '@playwright/test';

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
    if (width > 720) await expect(header).toBeVisible();
    else await expect(header).toBeHidden();
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    await expect(header.locator('strong')).toHaveText('2026 서비스 디자인 프로젝트');
    await expect(breadcrumb.locator('button')).toHaveText('삼위일체');
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('산출물');
    await expect(breadcrumb).not.toContainText('2026 서비스 디자인 프로젝트');
    await page.getByRole('button', { name: 'Fairplay', exact: true }).click();
    await expect(header.locator('strong')).toHaveText('내 스페이스');
    if (!await page.getByLabel('미리보기 역할').isVisible())
      await page.getByText('미리보기 설정', { exact: true }).click();
    await page.getByLabel('미리보기 역할').selectOption('manager');
    await page.goto('/preview/spaces/1/settings');
    await expect(header.locator('strong')).toHaveText('2026 서비스 디자인 프로젝트');
    await expect(header).not.toContainText('삼위일체');
    await expect(breadcrumb.locator('button')).toHaveCount(0);
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('스페이스 관리');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1920, 1440, 1024, 768]) {
  test(`헤더 중앙 정렬 ${width}px: 로고·프로필 폭과 무관하게 스페이스 이름 중앙 유지`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/deliverables');
    const label = page.getByLabel('현재 화면 정보').locator('strong');
    await expect(label).toHaveText('2026 서비스 디자인 프로젝트');
    const bounds = await label.boundingBox();
    expect(Math.abs(bounds.x + bounds.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    const brand = await page.locator('.topbar-brand').boundingBox();
    const profile = await page.locator('.profile-area').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(brand.x + brand.width);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(profile.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1440, 1024, 390, 320]) {
  test(`팀 홈 ${width}px: 확인할 작업 버튼의 문구와 건수 줄바꿈 방지`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    await expect(page.getByRole('heading', { name: '지금 확인할 작업', exact: true })).toBeVisible();
    const buttons = await page.locator('.action-summary button').evaluateAll(elements => elements.map(button => {
      const title = button.querySelector('.home-action-title');
      const parts = [...title.children].map(el => el.getBoundingClientRect());
      const lineHeight = Math.max(...[...title.children].map(el => parseFloat(getComputedStyle(el).lineHeight)));
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
    expect(layout.heading).toBeLessThanOrEqual(27);
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
    await expect(page.locator('.task-state-in_progress .status-dot')).toHaveCSS('background-color', 'rgb(85, 185, 0)');
    await expect(page.locator('.task-state-pending_approval .status-dot')).toHaveCSS('background-color', 'rgb(0, 181, 232)');
    await expect(page.locator('.task-state-done .status-dot')).toHaveCSS('background-color', 'rgb(18, 184, 134)');
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('desktop-task-board.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (!await page.getByLabel('미리보기 역할').isVisible())
      await page.getByText('미리보기 설정', { exact: true }).click();
    await page.getByLabel('미리보기 역할').selectOption('manager');
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
    await expect(page.locator('.topbar .logo-mark')).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    await expect(page.locator('.space-list')).toBeVisible();
    await expect(page.getByLabel('스페이스 이름 검색')).toBeVisible();
    await expect(page.getByLabel('내 역할 필터')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.goto('/preview/login');
    const intro = await page.locator('.login-introduction').boundingBox();
    const actions = await page.locator('.login-actions').boundingBox();
    if (width > 720) {
      expect(Math.abs(intro.y - actions.y)).toBeLessThanOrEqual(1);
      expect(actions.x).toBeGreaterThanOrEqual(intro.x + intro.width - 1);
    } else {
      expect(actions.y).toBeGreaterThanOrEqual(intro.y + intro.height - 1);
    }
    await expect(page.getByRole('button', { name: '로그인 없이 화면 미리보기' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

for (const width of [1920, 1440, 1280, 1024, 768, 390, 320]) {
  test(`작업 카드 ${width}px: 작업량 한 줄과 카드 정렬 유지`, async ({ page }) => {
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
      const backgrounds = await page.locator('.task-column').evaluateAll(elements => elements.map(el => {
        const last = el.querySelector('.board-task-card:last-child');
        return el.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom;
      }));
      for (const extraHeight of backgrounds) expect(extraHeight).toBeLessThanOrEqual(12);
    }
    const cards = await page.locator('.board-task-card').evaluateAll((elements) => elements.map((card) => {
      const box = card.getBoundingClientRect();
      const workload = card.querySelector('.task-workload-line');
      const range = document.createRange();
      range.selectNodeContents(workload);
      const textBox = range.getBoundingClientRect();
      const workloadBox = workload.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        workloadTop: workloadBox.top - box.top,
        deadlineTop: card.querySelector('.task-deadline').getBoundingClientRect().top - box.top,
        textHeight: textBox.height,
        lineHeight: parseFloat(getComputedStyle(workload).lineHeight),
        textFits: textBox.right <= workloadBox.right - parseFloat(getComputedStyle(workload).paddingRight) + 1,
        labelsHorizontal: [...card.querySelectorAll('.task-card-meta dt')].every(label => {
          const range = document.createRange();
          range.selectNodeContents(label);
          return range.getBoundingClientRect().height <= parseFloat(getComputedStyle(label).lineHeight) + 1;
        }),
      };
    }));
    for (const card of cards) {
      expect(card.textHeight).toBeLessThanOrEqual(card.lineHeight + 1);
      expect(card.textFits).toBe(true);
      expect(card.labelsHorizontal).toBe(true);
      for (const key of ['width', 'height', 'workloadTop', 'deadlineTop'])
        expect(Math.abs(card[key] - cards[0][key]), `${key}: ${JSON.stringify(cards)}`).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
