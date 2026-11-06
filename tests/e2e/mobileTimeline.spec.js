import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

const route = '/preview/spaces/1/teams/1/tasks?view=timeline&month=2026-11';
const longTitle = '모바일에서도 긴 작업 제목과 일정 정보를 함께 읽고 확인하는 작업';

async function openTimeline(page, months = 1, customize = () => {}) {
  await page.clock.setFixedTime(new Date('2026-11-06T03:00:00Z'));
  const state = structuredClone(getMockState(previewContext()));
  state.teams[1].tasks.forEach((task, index) => {
    task.startAt = index === 1 ? '2026-11-03T09:00:00' : '2026-11-02T09:00:00';
    task.dueAt = index === 1 ? '2026-11-04T18:00:00' : '2026-11-20T18:00:00';
    if (index === 0) task.title = longTitle;
  });
  customize(state);
  await page.addInitScript(state => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v11:preview:1', JSON.stringify(state));
  }, state);
  await page.goto(`${route}&months=${months}`);
  await expect(page.locator('.timeline-period').first()).toBeVisible();
}

for (const width of [320, 390, 510, 720, 1024, 1440]) {
  for (const months of [1, 3]) {
    test(`${width}px ${months}개월: 제목 아래 막대를 같은 날짜 축에 맞추고 가로 이동 없이 읽는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openTimeline(page, months);
      const region = page.getByRole('region', { name: '작업 계획 타임라인' });
      await expect(region.locator('.timeline-header .timeline-task-label')).toBeHidden();
      expect(await region.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await region.evaluate(el => { el.scrollLeft = 200; });
      expect(await region.evaluate(el => el.scrollLeft)).toBe(0);
      const axis = await region.locator('.timeline-scale').boundingBox();
      for (const row of await region.locator('.timeline-row:not(.timeline-header)').all()) {
        const title = await row.locator('.timeline-task-label').boundingBox();
        const track = await row.locator('.timeline-track').boundingBox();
        expect(track.y).toBeGreaterThanOrEqual(title.y + title.height);
        expect(Math.abs(track.x - axis.x)).toBeLessThan(1);
        expect(Math.abs(track.width - axis.width)).toBeLessThan(1);
        const bar = await row.locator('.timeline-period').boundingBox();
        expect(bar.x).toBeGreaterThanOrEqual(track.x - 1);
        expect(bar.x + bar.width).toBeLessThanOrEqual(track.x + track.width + 1);
      }
      for (const tick of await region.locator('.timeline-weeks > span').all()) {
        const box = await tick.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(axis.x);
        expect(box.x + box.width).toBeLessThanOrEqual(axis.x + axis.width + 1);
      }
      const matchingBars = await region.locator('.timeline-row:not(.timeline-header):not(.is-late) .timeline-period').evaluateAll(bars => bars.map(bar => {
        const track = bar.closest('.timeline-track').getBoundingClientRect();
        const rect = bar.getBoundingClientRect();
        return [(rect.x - track.x) / track.width, rect.width / track.width];
      }));
      for (const [left, length] of matchingBars) {
        expect(Math.abs(left - matchingBars[0][0])).toBeLessThan(0.001);
        expect(Math.abs(length - matchingBars[0][1])).toBeLessThan(0.001);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

for (const width of [320, 390, 720]) {
  test(`${width}px: 두 행 조작과 상태별 개수를 표시하고 재선택으로 필터를 해제한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openTimeline(page);
    const navigation = await page.locator('.task-month-navigation').boundingBox();
    const range = await page.getByRole('group', { name: '타임라인 표시 기간' }).boundingBox();
    const mine = page.getByRole('button', { name: '내 담당', exact: true });
    const filters = page.getByRole('group', { name: '타임라인 상태 필터' });
    expect(range.y).toBeGreaterThanOrEqual(navigation.y + navigation.height);
    expect(Math.abs((await mine.boundingBox()).y - range.y)).toBeLessThan(2);
    await expect(filters).toBeVisible();
    const cards = await filters.getByRole('button').all();
    const boxes = await Promise.all(cards.map(card => card.boundingBox()));
    for (const box of boxes) {
      expect(Math.abs(box.y - boxes[0].y)).toBeLessThan(1);
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
    }
    const counts = filters.locator('.task-board-status-count');
    await expect(counts).toHaveText(['1', '1', '1', '3']);
    const label = page.locator('.timeline-row:not(.timeline-header) .timeline-task-label').first();
    expect((await label.boundingBox()).width).toBeGreaterThan(width * 0.8);
    const title = label.getByRole('button');
    const titleBox = await title.boundingBox();
    expect(titleBox.height).toBeLessThanOrEqual(parseFloat(await title.evaluate(el => getComputedStyle(el).lineHeight)) * 2 + 1);
    expect(titleBox.y + titleBox.height).toBeLessThan(844);
    await expect(page.locator('.timeline-assignees').first()).toBeHidden();
    const selected = filters.getByRole('button', { name: '진행 중', exact: true });
    await selected.click();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/status=IN_PROGRESS/);
    await expect(page.locator('.timeline-row:not(.timeline-header)')).toHaveCount(1);
    await expect(counts).toHaveText(['1', '1', '1', '3']);
    await page.reload();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await selected.click();
    await expect(page.locator('.timeline-row:not(.timeline-header)')).toHaveCount(6);
    expect(new URL(page.url()).searchParams.has('status')).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [390, 1440]) {
  test(`${width}px: 상태 개수는 조회 기간과 담당 조건을 반영하고 보드 필터와 독립적이다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openTimeline(page, 1, state => {
      const tasks = state.teams[1].tasks;
      tasks[0].startAt = '2026-10-01T09:00:00';
      tasks[0].dueAt = '2026-10-02T18:00:00'; // completed outside this window
      tasks[2].startAt = '2026-12-01T09:00:00';
      tasks[2].dueAt = '2026-12-10T18:00:00'; // visible only in the 3-month window
      tasks[3].assignees = [{ userId: 999, weight: 100 }];
    });
    const filters = page.getByRole('group', { name: '타임라인 상태 필터' });
    const counts = filters.locator('.task-board-status-count');
    await expect(counts).toHaveText(['1', '1', '0', '2']);
    await page.getByRole('button', { name: '3개월', exact: true }).click();
    await expect(counts).toHaveText(['1', '1', '1', '2']);
    await page.getByRole('button', { name: '내 담당', exact: true }).click();
    await expect(counts).toHaveText(['0', '1', '1', '1']);
    await filters.getByRole('button', { name: '진행 중', exact: true }).click();
    await expect(counts).toHaveText(['0', '1', '1', '1']);
    await page.getByRole('button', { name: '보드', exact: true }).click();
    await expect(page.getByRole('group', { name: '보드 상태 선택' }).getByRole('button', { pressed: true })).toHaveCount(0);
    await page.getByRole('button', { name: '타임라인', exact: true }).click();
    await expect(filters.getByRole('button', { name: '진행 중', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(counts).toHaveText(['0', '1', '1', '1']);
  });
}

for (const width of [320, 390, 720]) {
  test(`${width}px: 막대와 작업명 모두 미리보기를 먼저 열고 닫으면 초점·스크롤을 복원한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openTimeline(page);
    const region = page.locator('.task-timeline-scroll');
    await region.scrollIntoViewIfNeeded();
    await region.evaluate(el => { el.scrollLeft = Math.min(60, el.scrollWidth - el.clientWidth); });
    const row = page.locator('.timeline-row:not(.timeline-header)').first();
    const bar = row.locator('.timeline-period');
    const before = await region.evaluate(el => el.scrollLeft);
    const url = page.url();
    const barBox = await bar.boundingBox();
    const regionBox = await region.boundingBox();
    const left = Math.max(barBox.x, regionBox.x + 8);
    const right = Math.min(barBox.x + barBox.width, regionBox.x + regionBox.width - 8);
    await page.mouse.click((left + right) / 2, barBox.y + barBox.height / 2);
    const dialog = page.getByRole('dialog', { name: '작업 미리보기', exact: true });
    await expect(dialog).toContainText(longTitle);
    for (const label of ['담당', '시작일', '마감일']) await expect(dialog.locator('dt').getByText(label, { exact: true })).toBeVisible();
    expect(page.url()).toBe(url);
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: '미리보기 닫기', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: '작업 상세 보기', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(bar).toBeFocused();
    expect(await region.evaluate(el => el.scrollLeft)).toBe(before);
    const title = row.getByRole('button', { name: longTitle, exact: true });
    await title.click();
    await expect(dialog).toContainText(longTitle);
    expect(page.url()).toBe(url);
    await expect(title).toHaveAttribute('aria-expanded', 'true');
    await dialog.getByRole('button', { name: '미리보기 닫기', exact: true }).click();
    await expect(title).toBeFocused();
    await title.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '작업 상세 보기', exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\/101(?:\?|$)/);
  });
}

test('터치 장치에서 막대를 탭해 상세로 이동하며 데스크톱 전환 시 미리보기를 닫는다', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openTimeline(page);
  const bar = page.locator('.timeline-period').first();
  await bar.tap();
  const dialog = page.getByRole('dialog', { name: '작업 미리보기', exact: true });
  await dialog.getByRole('button', { name: '작업 상세 보기', exact: true }).tap();
  await expect(page).toHaveURL(/\/tasks\/101(?:\?|$)/);
  await page.goBack();
  await bar.tap();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.getByRole('group', { name: '타임라인 상태 필터' })).toBeVisible();
  await expect(page.getByRole('separator', { name: '작업명 영역 너비' })).toHaveCount(0);
  await expect(bar.locator('.timeline-assignees')).toBeHidden();
  await bar.hover();
  await expect(page.getByRole('tooltip').and(page.locator('.timeline-preview'))).toContainText(longTitle);
  await page.keyboard.press('Escape');
  await context.close();
});

test('모바일에서 막대 위를 가로로 밀어도 날짜가 밀리거나 미리보기가 열리지 않는다', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openTimeline(page);
  const region = page.locator('.task-timeline-scroll');
  await region.scrollIntoViewIfNeeded();
  const box = await region.boundingBox();
  const bar = await page.locator('.timeline-period').first().boundingBox();
  const x = Math.min(bar.x + bar.width - 12, box.x + box.width - 24), y = bar.y + bar.height / 2;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (const offset of [20, 50, 90, 130]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - offset, y }] });
    await page.waitForTimeout(30);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await region.evaluate(el => el.scrollLeft)).toBe(0);
  await expect(page.getByRole('dialog', { name: '작업 미리보기', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/preview/spaces/1/teams/1/tasks');
  await context.close();
});

test('높이가 낮은 모바일에서도 긴 제목의 미리보기를 스크롤해 상세 버튼을 누를 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await openTimeline(page);
  await page.locator('.timeline-period').first().click();
  const dialog = page.getByRole('dialog', { name: '작업 미리보기', exact: true });
  const body = dialog.locator('.modal-body');
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  const open = dialog.getByRole('button', { name: '작업 상세 보기', exact: true });
  await open.scrollIntoViewIfNeeded();
  const bounds = await open.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(360);
  await open.click();
  await expect(page).toHaveURL(/\/tasks\/101(?:\?|$)/);
});
