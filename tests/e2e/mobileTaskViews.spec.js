import { test, expect } from '@playwright/test';

const taskRoute = '/preview/spaces/1/teams/1/tasks';

for (const width of [320, 390, 615, 720, 1024, 1440]) {
  test(`${width}px: 날짜 눈금이 겹치지 않고 월말까지 균일한 날짜 축을 사용한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const month of ['2026-11', '2028-02']) {
      for (const months of [1, 3]) {
        await page.goto(`${taskRoute}?view=timeline&month=${month}&months=${months}`);
        const weeks = page.locator('.timeline-weeks');
        await expect(weeks.locator('span').first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const values = await weeks.evaluate(el => {
          const bounds = el.getBoundingClientRect();
          const ticks = [...el.children].map(span => {
            const range = document.createRange();
            range.selectNodeContents(span);
            const rect = range.getBoundingClientRect();
            return { text: span.textContent, x: rect.x, right: rect.right, center: span.getBoundingClientRect().x + span.getBoundingClientRect().width / 2 };
          });
          return { left: bounds.x, right: bounds.right, ticks };
        });
        for (let i = 0; i < values.ticks.length; i++) {
          const tick = values.ticks[i];
          expect(tick.x).toBeGreaterThanOrEqual(values.left);
          expect(tick.right).toBeLessThanOrEqual(values.right);
          if (i > 0) expect(tick.x - values.ticks[i - 1].right).toBeGreaterThanOrEqual(6);
        }
        if (months === 1) await expect(weeks.locator('span')).toHaveText(month === '2026-11' ? ['11/1', '11/8', '11/15', '11/22', '11/29'] : ['2/1', '2/8', '2/15', '2/22', '2/29']);
        if (width === 615 && months === 1) {
          const centers = values.ticks.slice(1).map(tick => tick.center);
          const gaps = centers.slice(1).map((center, index) => center - centers[index]);
          expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1);
        }
        expect(await page.locator('.task-timeline-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
    }
  });

  test(`${width}px: 보드와 타임라인의 상태 필터 카드 크기를 동일하게 표시한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${taskRoute}?view=board`);
    const status = page.locator('.task-board-status-buttons');
    await expect(status.getByRole('button')).toHaveCount(4);
    const measure = () => status.getByRole('button').evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
      const title = button.querySelector('.task-board-status-title').getBoundingClientRect();
      return { width: rect.width, height: rect.height, font: style.fontSize, padding: style.padding, titleHeight: title.height };
    }));
    const board = await measure();
    await page.getByRole('button', { name: '타임라인', exact: true }).click();
    await expect(page.getByRole('group', { name: '타임라인 상태 필터' })).toBeVisible();
    const timeline = await measure();
    for (let i = 0; i < board.length; i++) {
      expect(Math.abs(timeline[i].width - board[i].width)).toBeLessThan(1);
      expect(Math.abs(timeline[i].height - board[i].height)).toBeLessThan(1);
      expect(timeline[i].font).toBe(board[i].font);
      expect(timeline[i].padding).toBe(board[i].padding);
      expect(timeline[i].titleHeight).toBe(board[i].titleHeight);
    }
  });
}

for (const width of [320, 615, 720]) {
  for (const source of ['url', 'saved', 'calendar']) {
    test(`${width}px ${source}: 모바일 목록 진입을 타임라인으로 바꾸고 상세 복귀 후에도 유지한다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => localStorage.setItem('fairplay:task-view-preferences', JSON.stringify({ view: 'list', labelWidth: 300 })));
      await page.goto(`${taskRoute}?month=2026-11&months=3&status=IN_PROGRESS&keep=1&page=2${source === 'url' ? '&view=list' : source === 'calendar' ? '&view=calendar' : ''}`);
      const views = page.getByRole('group', { name: '작업 보기 방식' });
      await expect(views.getByRole('button')).toHaveText(['보드', '타임라인']);
      await expect(views.getByRole('button', { name: '타임라인', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/view=timeline/);
      expect(new URL(page.url()).searchParams.get('status')).toBe('IN_PROGRESS');
      expect(new URL(page.url()).searchParams.get('keep')).toBe('1');
      expect(new URL(page.url()).searchParams.has('page')).toBe(false);
      await expect(page.getByRole('table', { name: '정렬된 작업 목록' })).toHaveCount(0);
      await page.locator('.timeline-period').first().click();
      await page.getByRole('dialog', { name: '작업 미리보기', exact: true }).getByRole('button', { name: '작업 상세 보기', exact: true }).click();
      await expect(page).toHaveURL(/tasks\/102/);
      await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
      await expect(views.getByRole('button')).toHaveText(['보드', '타임라인']);
      await expect(page).toHaveURL(/view=timeline/);
      await page.reload();
      await expect(views.getByRole('button', { name: '타임라인', exact: true })).toHaveAttribute('aria-pressed', 'true');
    });
  }
}

test('화면 크기를 바꾸면 모바일에서 목록을 닫고 데스크톱에서 다시 선택할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${taskRoute}?view=list&month=2026-11&q=AI&status=REVISING&page=2`);
  const views = page.getByRole('group', { name: '작업 보기 방식' });
  await expect(views.getByRole('button')).toHaveText(['보드', '목록', '타임라인']);
  await expect(page.getByRole('table', { name: '정렬된 작업 목록' })).toBeVisible();
  await page.setViewportSize({ width: 720, height: 844 });
  await expect(views.getByRole('button')).toHaveText(['보드', '타임라인']);
  await expect(page).toHaveURL(/view=timeline/);
  await expect(page.getByRole('table', { name: '정렬된 작업 목록' })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('q')).toBe('AI');
  await page.setViewportSize({ width: 721, height: 844 });
  await expect(views.getByRole('button')).toHaveText(['보드', '목록', '타임라인']);
  await views.getByRole('button', { name: '목록', exact: true }).click();
  await expect(page.getByRole('table', { name: '정렬된 작업 목록' })).toBeVisible();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('AI');
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('REVISING');
});
