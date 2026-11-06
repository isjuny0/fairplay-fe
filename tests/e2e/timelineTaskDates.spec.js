import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';

const title = '작업명이 아주 길어도 날짜와 겹치지 않고 작업 정보를 확인할 수 있어야 하는 타임라인 검증 작업';
const route = '/preview/spaces/1/teams/1/tasks?view=timeline&month=2026-11';

for (const width of [320, 390, 615, 720, 1024, 1440]) {
  test(`${width}px: 작업명 아래의 날짜를 한 줄로 읽고 지연 표시와 막대가 겹치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-11-06T03:00:00Z'));
    const state = structuredClone(getMockState(previewContext()));
    const tasks = state.teams[1].tasks;
    Object.assign(tasks[1], { title, startAt: '2026-10-01T09:00:00', dueAt: '2026-11-04T18:00:00' });
    Object.assign(tasks[3], { startAt: '2026-10-31T09:00:00', dueAt: '2026-12-31T18:00:00' });
    await page.addInitScript(state => {
      localStorage.setItem('fairplay:preview-role', 'leader');
      localStorage.setItem('fairplay:mock:v11:preview:1', JSON.stringify(state));
    }, state);
    await page.goto(route);
    const rows = page.locator('.timeline-row:not(.timeline-header)');
    await expect(rows).toHaveCount(6);
    for (const row of await rows.all()) {
      const label = await row.locator('.timeline-task-label').boundingBox();
      const name = await row.locator('.timeline-task-name').boundingBox();
      const taskTitle = await row.locator('.task-title-button').boundingBox();
      const date = await row.locator('.timeline-row-dates').boundingBox();
      const meta = await row.locator('.timeline-task-meta').boundingBox();
      const track = await row.locator('.timeline-track').boundingBox();
      expect(date.y).toBeGreaterThanOrEqual(taskTitle.y + taskTitle.height);
      expect(Math.abs(date.x - taskTitle.x)).toBeLessThan(1);
      expect(date.height).toBeLessThan(22);
      expect(meta.x + meta.width).toBeLessThanOrEqual(label.x + label.width);
      expect(track.y).toBeGreaterThanOrEqual(Math.max(meta.y + meta.height, name.y + name.height));
      for (const badge of await row.locator('.timeline-late-label, .timeline-start-label').all()) {
        const box = await badge.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(meta.x);
        expect(box.x + box.width).toBeLessThanOrEqual(label.x + label.width);
        const intersects = box.x < date.x + date.width && box.x + box.width > date.x && box.y < date.y + date.height && box.y + box.height > date.y;
        expect(intersects).toBe(false);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const row = rows.filter({ has: page.getByRole('button', { name: title, exact: true }) });
    await expect(row.locator('.timeline-row-dates')).toHaveText('10/1 – 11/4');
    await expect(row.locator('.timeline-late-label')).toHaveText('1일 지연');
    const button = row.getByRole('button', { name: title, exact: true });
    if (width <= 720) {
      await button.click();
      const preview = page.getByRole('dialog', { name: '작업 미리보기', exact: true });
      await expect(preview).toContainText(title);
      await expect(preview).toContainText('2026. 10. 01. 09:00');
      await preview.getByRole('button', { name: '미리보기 닫기', exact: true }).click();
      await expect(button).toBeFocused();
    } else {
      await button.focus();
      await expect(page.getByRole('tooltip').and(page.locator('.timeline-preview'))).toContainText(title);
      await page.keyboard.press('Escape');
    }
    await page.getByRole('group', { name: '타임라인 상태 필터' }).getByRole('button', { name: '진행 중', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.locator('.timeline-row-dates')).toHaveText('10/1 – 11/4');
  });
}
