import { test, expect } from '@playwright/test';

const team = '/preview/spaces/1/teams/1';
const widths = [320, 390, 469, 545, 720, 768, 1024, 1440];

async function textRects(locator) {
  return locator.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()]
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => rect.toJSON());
  });
}

for (const width of [320, 545]) {
  test(`${width}px: 작업 설명은 단어를 유지하면서 긴 주소를 화면 안에서 줄바꿈한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/main');
    await page.evaluate(async () => {
      const { getMockState, saveMockState } = await import('/src/mock/planned.js');
      const { previewContext } = await import('/src/mock/preview.js');
      const context = previewContext();
      const state = getMockState(context);
      state.teams[1].tasks.find(task => task.id === 102).description =
        '조사 결과를 바탕으로 주요 발견과 개선안을 정리합니다. 결과에 근거와 다음 단계 제안을 포함해 주세요.\nhttps://example.com/' + 'long-address'.repeat(30);
      saveMockState(context, state);
    });
    await page.goto(`${team}/tasks/102`);
    const description = page.locator('.task-description-card .preserve-lines');
    await expect(description).toContainText('결과에 근거와 다음 단계 제안을 포함해 주세요.');
    const splitWords = await description.evaluate(element => {
      const text = element.firstChild;
      return [...text.textContent.matchAll(/[가-힣]+/g)].filter(match => {
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        return range.getClientRects().length > 1;
      }).map(match => match[0]);
    });
    expect(splitWords).toEqual([]);
    expect(await description.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  });
}

test('월 첫날에도 타임라인의 오늘 표시 전체를 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.clock.install({ time: new Date('2026-11-01T03:00:00Z') });
  await page.goto(`${team}/tasks?view=timeline`);
  const today = page.locator('.timeline-today-label');
  await expect(today).toBeVisible();
  const label = await today.boundingBox();
  const scale = await page.locator('.timeline-scale').boundingBox();
  expect(label.x).toBeGreaterThanOrEqual(scale.x);
  expect(label.x + label.width).toBeLessThanOrEqual(scale.x + scale.width);
});

function overlaps(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
}

for (const width of widths) {
  test(`${width}px: 긴 스페이스 제목과 소개가 겹치거나 잘리지 않는다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/main');
    const title = '함께 만드는 서비스 디자인 프로젝트와 사용자 경험 개선을 위한 긴 스페이스 이름';
    const description = '모바일과 데스크톱에서 함께 일하는 팀의 프로젝트입니다. '.repeat(8);
    await page.evaluate(async ({ title, description }) => {
      const { getMockState, saveMockState } = await import('/src/mock/planned.js');
      const { previewContext } = await import('/src/mock/preview.js');
      const context = previewContext();
      const state = getMockState(context);
      state.spaceOverrides = { ...state.spaceOverrides, name: title, description };
      saveMockState(context, state);
    }, { title, description });
    await page.goto('/preview/spaces/1');
    const heading = page.locator('.space-page-heading');
    const intro = page.locator('.space-page-description');
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(intro).toHaveText(description.trim());
    const headingBox = await heading.boundingBox();
    const introBox = await intro.boundingBox();
    expect(introBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height + 10);
    for (const locator of [page.locator('.space-home-title-row h1'), intro]) {
      expect(await locator.evaluate(e => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('long-space-heading.png'), animations: 'disabled' });
  });

  test(`${width}px: 팀 홈의 버튼 문구를 한 줄로 읽고 메뉴 현재 위치를 확인한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(team);
    const buttons = page.locator('.dashboard-heading-actions > button, .dashboard-heading-actions > details > summary');
    await expect(buttons).toHaveCount(2);
    for (const button of await buttons.all()) {
      const lines = await button.evaluate(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const tops = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(walker.currentNode);
          tops.push(...[...range.getClientRects()].map(rect => Math.round(rect.top)));
        }
        return [...new Set(tops)];
      });
      expect(lines).toHaveLength(1);
    }
    if (width <= 720) {
      for (const [route, label] of [[team, '팀 홈'], [`${team}/meeting-minutes`, '회의록'], [`${team}/mid-feedback`, '중간 피드백']]) {
        await page.goto(route);
        const current = page.locator('.mobile-menu-current');
        await expect(current).toHaveText(label);
        expect(await textRects(current)).toHaveLength(1);
        const action = page.locator('.mobile-menu-action');
        const currentRect = (await textRects(current))[0];
        const actionRect = (await textRects(action))[0];
        expect(Math.abs(currentRect.top - actionRect.top)).toBeLessThan(3);
        const toggle = await page.locator('.mobile-space-toggle').boundingBox();
        const menu = await page.locator('.mobile-menu-location').boundingBox();
        const context = await page.locator('.mobile-workspace-context').boundingBox();
        expect(menu.x).toBeGreaterThanOrEqual(context.x + context.width + 10);
        expect(menu.y).toBeGreaterThanOrEqual(toggle.y);
        expect(menu.y + menu.height).toBeLessThanOrEqual(toggle.y + toggle.height);
      }
    }
    await page.screenshot({ path: info.outputPath('readable-team-controls.png'), animations: 'disabled' });
  });

  test(`${width}px: 타임라인의 날짜와 오늘 표시가 서로 가리지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${team}/tasks?view=timeline`);
    const today = page.locator('.timeline-today-label');
    await expect(today).toBeVisible();
    const todayRect = (await textRects(today))[0];
    for (const date of await page.locator('.timeline-weeks > span').all()) {
      for (const dateRect of await textRects(date)) expect(overlaps(todayRect, dateRect)).toBe(false);
    }
  });
}
