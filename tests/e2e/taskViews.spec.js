import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';
import { currentTaskMonth } from '../../src/lib/taskSchedule.js';

const timelinePreview = (page) =>
  page.getByRole('tooltip').and(page.locator('.timeline-preview'));

async function seed(page, view = 'list', extra = '', customize = () => {}) {
  const state = structuredClone(getMockState(previewContext()));
  const dates = [
    '2026-11-01T00:00:00',
    '2026-10-31T23:59:00',
    '2026-11-12T09:00:00',
    '2026-11-12T11:00:00',
    '2026-11-12T13:00:00',
    '2026-11-12T15:00:00',
  ];
  state.teams[1].tasks.forEach((task, index) => {
    task.dueAt = dates[index];
    task.startAt = [
      '2026-10-30T09:00:00',
      '2026-10-20T09:00:00',
      '2026-10-28T09:00:00',
      dates[3],
      dates[4],
      '2026-11-10T09:00:00',
    ][index];
  });
  customize(state);
  await page.addInitScript((state) => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v11:preview:1', JSON.stringify(state));
  }, state);
  await page.goto(
    `/preview/spaces/1/teams/1/tasks?view=${view}&month=2026-11${view === 'timeline' ? '&months=3' : ''}${extra}`,
  );
  await expect(
    page.getByRole('heading', { name: '작업', exact: true }),
  ).toBeVisible();
}

async function searchTasks(page, query) {
  const timeline = await page.getByRole('button', { name: '타임라인', exact: true }).getAttribute('aria-pressed') === 'true';
  if (timeline) await page.getByRole('button', { name: '목록', exact: true }).click();
  await page.getByLabel('작업 제목 검색').fill(query);
  if (timeline) await page.getByRole('button', { name: '타임라인', exact: true }).click();
}

test('목록은 일곱 열의 표로 제공하고 상세 복귀·필터·보기 전환을 유지한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page);
  const table = page.getByRole('table', { name: '정렬된 작업 목록' });
  await expect(table.getByRole('columnheader')).toHaveText([
    '작업',
    '상태',
    '담당자·배분',
    '예상 작업량',
    '시작일',
    '마감일',
  ]);
  await expect(table.getByRole('row')).toHaveCount(7);
  const tableRegion = page.getByRole('region', { name: '작업 표', exact: true });
  await expect(tableRegion).toHaveCSS('border-left-width', '0px');
  await expect(tableRegion).toHaveCSS('border-top-width', '1px');
  await expect(tableRegion).toHaveCSS('border-radius', '0px');
  const pagination = page.getByRole('navigation', { name: '작업 목록 페이지' });
  await expect(pagination).toContainText('1페이지');
  await expect(pagination.getByRole('button', { name: '이전', exact: true })).toBeDisabled();
  await expect(pagination.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('task-table.png'),
    fullPage: true,
  });
  await searchTasks(page, '팀 자료');
  await expect(table.getByRole('row')).toHaveCount(2);
  await table
    .getByRole('button', { name: '팀 자료 검색 개선', exact: true })
    .click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('팀 자료');
  await page.reload();
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.getByRole('button', { name: '타임라인', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('q')).toBe('팀 자료');
  await page.goBack();
  await expect(table).toBeVisible();
});

test('작업 목록은 20건씩 표시하고 상세 복귀·새로고침 시 페이지를 유지한다', async ({ page }) => {
  await seed(page, 'list', '', (state) => {
    const [template] = state.teams[1].tasks;
    state.teams[1].tasks = Array.from({ length: 41 }, (_, index) => ({
      ...template,
      id: 200 + index,
      title: `페이지 테스트 작업 ${200 + index}`,
    }));
  });

  const table = page.getByRole('table', { name: '정렬된 작업 목록' });
  const rows = table.locator('tbody tr');
  const pagination = page.getByRole('navigation', { name: '작업 목록 페이지' });
  const previous = pagination.getByRole('button', { name: '이전', exact: true });
  const next = pagination.getByRole('button', { name: '다음', exact: true });
  await expect(rows).toHaveCount(20);
  await expect(previous).toBeDisabled();

  await next.click();
  await expect(pagination).toContainText('2페이지');
  await expect(rows).toHaveCount(20);
  await table.getByRole('button', { name: '페이지 테스트 작업 220', exact: true }).click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(pagination).toContainText('2페이지');
  await page.reload();
  await expect(pagination).toContainText('2페이지');

  await searchTasks(page, '페이지 테스트 작업 200');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('페이지 테스트 작업 200');
  await expect(pagination).toContainText('1페이지');
  await expect(previous).toBeDisabled();
  await expect(next).toBeDisabled();
  await expect(page).not.toHaveURL(/[?&]page=/);

  await page.goto('/preview/spaces/1/teams/1/tasks?view=list&page=999');
  await expect(page).toHaveURL(/[?&]page=2(?:&|$)/);
  await expect(rows).toHaveCount(1);
  await expect(next).toBeDisabled();
});

test('타임라인은 3개월의 계획 기간을 주 눈금으로 비교하고 상세 복귀·필터를 유지한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install({ time: new Date('2026-11-15T09:00:00Z') });
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[3].status = 'IN_PROGRESS';
    state.teams[1].tasks[3].dueAt = '2026-12-10T09:00:00';
    state.teams[1].tasks[5].dueAt = '2027-01-12T09:00:00';
  });
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await expect(timeline.locator('.timeline-period')).toHaveCount(5);
  await expect(timeline.locator('.continues-before')).toHaveCount(2);
  const previousOverdueTask = timeline.locator('.timeline-row').filter({
    has: page.getByRole('button', { name: '팀 자료 검색 개선', exact: true }),
  });
  await expect(previousOverdueTask).toContainText('이전 기간 마감');
  await expect(previousOverdueTask.locator('.timeline-period')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('task-timeline.png'),
    fullPage: true,
  });
  await timeline
    .getByRole('button', { name: '스페이스·팀 권한 설계', exact: true })
    .click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '타임라인', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '이전 1개월', exact: true }).click();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2026-10');
  await expect(timeline.locator('.timeline-months > span')).toHaveText([
    '2026년 10월', '2026년 11월', '2026년 12월',
  ]);
  await expect(timeline.locator('.timeline-period')).toHaveCount(6);
  await searchTasks(page, '없는 작업');
  await expect(timeline.locator('.timeline-period')).toHaveCount(0);
  await expect(
    page.getByText('선택한 조건에 맞는 작업이 없습니다.', {
      exact: false,
    }),
  ).toBeVisible();
});

for (const width of [1440, 320])
  test(`${width}px의 세 보기는 페이지 밖으로 넘치지 않고 직접 주소로 복원된다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    for (const [view, label] of [
      ['board', '보드'],
      ['list', '목록'],
      ['timeline', '타임라인'],
    ]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (view === 'board') {
        const states = page.getByRole('group', { name: '보드 상태 선택' });
        await states.getByRole('button', { name: /할 일/ }).click();
        await expect(page.locator('.task-column')).toHaveCount(1);
        await expect(page.getByRole('region', { name: '할 일 작업' })).toBeVisible();
        await states.getByRole('button', { name: /할 일/ }).click();
        await expect(page.locator('.task-column')).toHaveCount(4);
        await expect(page.getByLabel('작업 제목 검색')).toHaveCount(0);
      }
      if (view === 'list')
        await expect(
          page.getByRole('table', { name: '정렬된 작업 목록' }),
        ).toBeVisible();
      if (view === 'timeline') await expect(page.locator('.task-board-page').getByRole('button', { name: '새로고침', exact: true })).toHaveCount(0);
      if (view === 'timeline')
        await expect(page.getByRole('button', { name: '일정 넓게 보기', exact: true })).toHaveCount(0);
    }
  });

test('잘못된 보기·조회 월 값은 기본 보드·현재 월로 복구한다', async ({
  page,
}) => {
  await seed(page, 'unknown', '&month=2026-99');
  await expect(
    page.getByRole('button', { name: '보드', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.goto(
    '/preview/spaces/1/teams/1/tasks?view=timeline&month=invalid',
  );
  await expect(page.getByLabel('조회 시작 월')).toHaveValue(currentTaskMonth());
});

test('3개월을 가로지르는 일정은 양쪽 연속 표시와 실제 기간을 유지한다', async ({
  page,
}) => {
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[0].startAt = '2026-10-31T23:59:00';
    state.teams[1].tasks[0].dueAt = '2027-02-01T09:00:00';
  });
  const bar = page.getByRole('button', { name: /스페이스·팀 권한 설계 · 시작일/ });
  await expect(bar).toHaveClass(/continues-before continues-after/);
  await expect(bar).toHaveCSS('left', '0px');
  const track = await bar.locator('..').boundingBox(),
    bounds = await bar.boundingBox();
  expect(Math.abs(bounds.width - track.width)).toBeLessThan(1);
  await expect(bar).toHaveAccessibleName(
    /2026\. 10\. 31\. 23:59.*2027\. 02\. 01\. 09:00/,
  );
  await bar.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: '스페이스·팀 권한 설계', exact: true }),
  ).toBeVisible();
});

test('3개월 타임라인은 시작일 순서·오늘·지연 구간을 표시하고 완료 작업을 제외한다', async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-15T09:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[0].status = 'DONE';
    state.teams[1].tasks[1].status = 'IN_PROGRESS';
    state.teams[1].tasks[3].status = 'TODO';
    state.teams[1].tasks[3].dueAt = '2026-12-01T09:00:00';
  });
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await expect(page.getByRole('group', { name: '타임라인 상태 필터' })).toContainText('진행 중');
  await expect(page.getByLabel(/일정 읽는 법 도움말/)).toHaveCount(0);
  await expect(
    page.locator('.task-month-select').filter({ hasText: '2026년 11월 – 2027년 1월' }),
  ).toBeVisible();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2026-11');
  await expect(timeline.locator('.timeline-months > span')).toHaveText([
    '2026년 11월',
    '2026년 12월',
    '2027년 1월',
  ]);
  await expect(timeline.locator('.timeline-weeks > span')).toHaveCount(13);
  await expect(
    timeline.locator('.timeline-task-label .task-title-button'),
  ).toHaveText([
    '팀 자료 검색 개선',
    'AI 피드백 화면 개선',
    '스페이스·팀 권한 설계',
    '종합 평가 리포트 연동',
    '전시 가이드 동선 점검',
    '작업 목록 페이지 이동',
  ]);
  await expect(timeline.locator('.timeline-row.is-late')).toHaveCount(2);
  await expect(timeline.locator('.timeline-delay')).toHaveCount(2);
  await expect(timeline.locator('.timeline-today-label')).toHaveText('오늘');
  await expect(
    timeline.getByText('시작 예정일 지남', { exact: true }),
  ).toBeVisible();
  await expect(timeline.locator('.timeline-day')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('task-timeline-delay.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: '다음 1개월' }).click();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2026-12');
  await expect(timeline.locator('.timeline-months > span')).toHaveText([
    '2026년 12월', '2027년 1월', '2027년 2월',
  ]);
  await expect(timeline.locator('.timeline-today-label')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2026-11');
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  await page.reload();
  await expect(timeline.locator('.timeline-task-label .task-title-button').first()).toHaveText('팀 자료 검색 개선');
});


test('타임라인 미리보기는 마우스·키보드로 확인하고 짧은 막대 주변도 선택할 수 있다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline');
  const bar = page.getByRole('button', { name: /전시 가이드 동선 점검 · 시작일/ });
  await bar.hover();
  const preview = timelinePreview(page);
  await expect(preview).toContainText('전시 가이드 동선 점검');
  await expect(preview).toContainText('담당');
  await expect(preview).toContainText('2026. 11. 12. 11:00');
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await bar.hover();
  await expect(preview).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(preview).toHaveCount(0);
  await bar.focus();
  await expect(preview).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('task-timeline-preview.png') });
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  const bounds = await bar.boundingBox();
  expect(bounds.width).toBeLessThan(12);
  // Click outside the visible duration, inside its transparent target.
  await page.mouse.click(bounds.x + bounds.width / 2 + 10, bounds.y + bounds.height / 2);
  await expect(page.getByRole('heading', { name: '전시 가이드 동선 점검', exact: true })).toBeVisible();
});

test('타임라인은 가로 이동 없이 페이지에서 세로 이동하고 날짜 축을 고정한다', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-15T09:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline', '', (state) => {
    const original = state.teams[1].tasks[0];
    for (let index = 0; index < 24; index++) {
      state.teams[1].tasks.push({ ...structuredClone(original), id: 1000 + index, title: `일정 검토 ${index + 1}`, startAt: '2026-11-01T09:00:00', dueAt: '2026-11-25T09:00:00' });
    }
  });
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  const regionBounds = await timeline.boundingBox();
  expect(regionBounds.height).toBeGreaterThan(1500);
  expect(await timeline.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await page.evaluate((top) => window.scrollTo(0, top + 300), regionBounds.y);
  await expect.poll(async () => {
    const header = await timeline.locator('.timeline-header').boundingBox();
    const topbar = await page.locator('.topbar').boundingBox();
    return Math.abs(header.y - topbar.y - topbar.height);
  }).toBeLessThan(2);
  await timeline.evaluate((element) => { element.scrollLeft = 120; element.scrollTop = 400; });
  expect(await timeline.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await timeline.evaluate(element => element.scrollLeft)).toBe(0);
  expect(await timeline.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const row = timeline.locator('.timeline-row:not(.timeline-header)').nth(5);
  const labelBounds = await row.locator('.timeline-task-label').boundingBox();
  const trackBounds = await row.locator('.timeline-track').boundingBox();
  expect(trackBounds.y).toBeGreaterThanOrEqual(labelBounds.y + labelBounds.height);
  await page.screenshot({ path: testInfo.outputPath('task-timeline-scroll.png') });
  await expect(page.getByLabel('조회 기간 작업 현황')).toHaveCount(0);
  await expect(timeline.locator('.timeline-row:not(.timeline-header)')).toHaveCount(30);
});


test('타임라인 상태 버튼은 재선택으로 해제하고 빈 결과에서도 다른 상태로 전환한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T09:00:00Z') });
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[3].startAt = '2026-11-01T09:00:00';
  });
  const filters = page.getByRole('group', { name: '타임라인 상태 필터' });
  await expect(filters.getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: /^필터(?: · \d+)?$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '가까운 마감으로', exact: true })).toHaveCount(0);
  await filters.getByRole('button', { name: '진행 중', exact: true }).click();
  await expect(filters.getByRole('button', { name: '진행 중', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.timeline-task-label .task-title-button')).toHaveCount(1);
  await page.reload();
  await expect(filters.getByRole('button', { name: '진행 중', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await filters.getByRole('button', { name: '진행 중', exact: true }).click();
  await expect(page.locator('.timeline-task-label .task-title-button')).toHaveCount(6);
  await expect(page.getByRole('button', { name: /^(마감 지남|시작 예정일 지남) \d/ })).toHaveCount(0);
  await searchTasks(page, '없는 작업');
  await filters.getByRole('button', { name: '완료', exact: true }).click();
  await expect(filters.getByRole('button', { name: '완료', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '필터 초기화', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await expect(page.locator('.timeline-task-label .task-title-button')).toHaveCount(6);
});

test('전체 너비 타임라인에서 미리보기를 닫아도 조회 조건과 날짜 축을 유지한다', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('fairplay:task-view-preferences', JSON.stringify({ view: 'timeline', labelWidth: 520 })));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline');
  await searchTasks(page, 'AI 피드백');
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await expect(page.getByRole('separator', { name: '작업명 영역 너비' })).toHaveCount(0);
  await expect(page.locator('.list-summary')).toHaveCount(0);
  await expect(page.locator('.timeline-task-label .task-title-button')).toHaveCount(1);
  const track = timeline.locator('.timeline-track');
  const before = await track.boundingBox();
  expect(before.width).toBeGreaterThan((await timeline.boundingBox()).width * 0.9);
  const task = page.getByRole('button', { name: 'AI 피드백 화면 개선', exact: true });
  await task.focus();
  await expect(timelinePreview(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(timelinePreview(page)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('q')).toBe('AI 피드백');
  const after = await track.boundingBox();
  expect(after).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('task-timeline-full-width.png') });
});

test('마우스로 잠깐 지나친 작업은 미리보기를 열지 않고 키보드 초점은 즉시 표시한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T09:00:00Z') });
  await seed(page, 'timeline');
  await page.clock.pauseAt(new Date('2026-10-15T09:01:00Z'));
  const task = page.getByRole('button', { name: 'AI 피드백 화면 개선', exact: true });
  await task.hover();
  await page.clock.runFor(150);
  await expect(timelinePreview(page)).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.clock.runFor(100);
  await expect(timelinePreview(page)).toHaveCount(0);
  await task.hover();
  await page.clock.runFor(220);
  await expect(timelinePreview(page)).toContainText('AI 피드백 화면 개선');
  await page.keyboard.press('Escape');
  await task.focus();
  await expect(timelinePreview(page)).toBeVisible();
});

test('작업 표는 페이지에서 세로로 이동하고 가로로 밀어도 작업 열을 유지한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page, 'list', '', (state) => {
    const original = state.teams[1].tasks[0];
    for (let index = 0; index < 24; index++) {
      state.teams[1].tasks.push({ ...structuredClone(original), id: 1000 + index, title: `검토 작업 ${index + 1}` });
    }
  });
  const table = page.getByRole('region', { name: '작업 표', exact: true });
  for (const badge of await table.locator('.status-badge').all()) {
    await expect(badge).toHaveCSS('white-space', 'nowrap');
  }
  await expect(table.locator('tbody tr')).toHaveCount(20);
  expect(await table.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await table.evaluate((element) => { element.scrollLeft = 150; });
  const bounds = await table.boundingBox();
  const corner = await table.getByRole('columnheader', { name: '작업', exact: true }).boundingBox();
  expect(Math.abs(corner.x - bounds.x)).toBeLessThan(2);
  const firstTask = await table.locator('tbody th').first().boundingBox();
  expect(Math.abs(firstTask.x - bounds.x)).toBeLessThan(2);
  expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const pagination = page.getByRole('navigation', { name: '작업 목록 페이지' });
  await pagination.scrollIntoViewIfNeeded();
  await expect(pagination).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await table.evaluate((element) => element.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('task-table-sticky.png') });
});


test('빈 기간에서 현재 검색과 담당 조건을 유지한 채 작업 있는 기간으로 이동한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline');
  await searchTasks(page, 'AI 피드백');
  await page.getByRole('button', { name: '내 담당', exact: true }).click();
  await page.getByLabel('조회 시작 월', { exact: true }).fill('2032-01');
  await expect(page.locator('.list-summary')).toHaveCount(0);
  await expect(page.getByText('이 기간에 표시할 작업이 없습니다.', { exact: true })).toBeVisible();
  await expect(page.locator('.timeline-months > span')).toHaveText(['2032년 1월', '2032년 2월', '2032년 3월']);
  await page.screenshot({ path: testInfo.outputPath('task-timeline-empty.png'), fullPage: true });
  await page.getByRole('button', { name: /\d{4}년 \d{1,2}월 보기/ }).click();
  await expect(page.getByLabel('조회 시작 월', { exact: true })).toHaveValue('2026-11');
  expect(new URL(page.url()).searchParams.get('q')).toBe('AI 피드백');
  await expect(page.getByRole('button', { name: '내 담당', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.list-summary')).toHaveCount(0);
  await expect(page.locator('.timeline-task-label .task-title-button')).toHaveCount(1);

  await expect(page.getByLabel(/일정 읽는 법 도움말/)).toHaveCount(0);
  await expect(page.getByText('기간 내 작업', { exact: false })).toHaveCount(0);
});

test('검색으로 빈 일정은 필터만 초기화하고 등록된 작업이 없으면 이동을 제안하지 않는다', async ({ page }) => {
  await seed(page, 'timeline');
  await page.getByLabel('조회 시작 월').fill('2032-01');
  await searchTasks(page, '없는 작업');
  await expect(page.getByRole('button', { name: /\d{4}년 \d{1,2}월 보기/ })).toHaveCount(0);
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2032-01');
  await expect(page.getByRole('button', { name: /\d{4}년 \d{1,2}월 보기/ })).toBeVisible();
  await page.addInitScript(() => {
    const state = JSON.parse(localStorage.getItem('fairplay:mock:v11:preview:1'));
    state.teams[1].tasks = [];
    localStorage.setItem('fairplay:mock:v11:preview:1', JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByText('아직 등록된 작업이 없습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /\d{4}년 \d{1,2}월 보기/ })).toHaveCount(0);
});

test('마지막 보기는 재방문에 복원하고 주소의 보기·필터·월은 우선 적용한다', async ({ page }) => {
  await seed(page, 'timeline');
  await page.reload();
  await expect(page.getByRole('region', { name: '작업 계획 타임라인' })).toBeVisible();
  await page.getByRole('button', { name: '팀 홈', exact: true }).click();
  await page.getByRole('button', { name: '작업', exact: true }).click();
  await expect(page.getByRole('button', { name: '타임라인', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: '작업 계획 타임라인' })).toBeVisible();
  await page.goto('/preview/spaces/1/teams/1/tasks?view=list&month=2026-11&q=AI+피드백&status=REVISING');
  await expect(page.getByRole('button', { name: '목록', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/month=2026-11/);
  expect(new URL(page.url()).searchParams.get('q')).toBe('AI 피드백');
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('REVISING');
  await page.goto('/preview/spaces/1/teams/1/tasks?month=2026-11');
  await expect(page.getByRole('button', { name: '목록', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('ALL');
  await expect(page).toHaveURL(/view=list/);
  await page.getByRole('button', { name: '보드', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('button', { name: '목록', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await expect(page.getByRole('button', { name: '보드', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: '보드', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('손상되거나 범위가 잘못된 보기 설정은 기본값으로 복구한다', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => localStorage.setItem('fairplay:task-view-preferences', '{broken'));
  await page.goto('/preview/spaces/1/teams/1/tasks?month=2026-11');
  await expect(page.getByRole('button', { name: '보드', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => localStorage.setItem('fairplay:task-view-preferences', JSON.stringify({ view: 'unknown', labelWidth: 9999 })));
  await page.goto('/preview/spaces/1/teams/1/tasks?view=timeline&month=2026-11');
  await expect(page.getByRole('region', { name: '작업 계획 타임라인' })).toBeVisible();
  expect(await page.locator('.task-timeline-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('브라우저 설정 저장이 차단되어도 작업 조회와 보기 전환이 가능하다', async ({ page }) => {
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key === 'fairplay:task-view-preferences') throw new DOMException('Blocked', 'SecurityError');
      return read.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key === 'fairplay:task-view-preferences') throw new DOMException('Blocked', 'SecurityError');
      return write.call(this, key, value);
    };
  });
  await seed(page, 'timeline');
  await expect(page.getByRole('region', { name: '작업 계획 타임라인' })).toBeVisible();
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await expect(page.getByRole('table', { name: '정렬된 작업 목록' })).toBeVisible();
});


test('열어 둔 타임라인은 분마다 지연을 갱신하고 창·탭 복귀 시 현재 시각을 반영한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T14:59:30Z') });
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks.forEach((task) => { task.status = 'DONE'; });
    Object.assign(state.teams[1].tasks[0], { status: 'IN_PROGRESS', startAt: '2026-11-14T09:00:00', dueAt: '2026-11-15T23:59:50' });
  });
  const row = page.locator('.timeline-row').filter({ has: page.getByRole('button', { name: '스페이스·팀 권한 설계', exact: true }) });
  await expect(row.locator('.timeline-late-label')).toHaveCount(0);
  await page.clock.runFor(60000);
  await expect(row.locator('.timeline-late-label')).toBeVisible();
  await expect(row.locator('.timeline-late-label')).toHaveText('마감 지남');
  await page.clock.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row.locator('.timeline-late-label')).toHaveText('2일 지연');
  await page.clock.setSystemTime(new Date('2026-11-18T15:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(row.locator('.timeline-late-label')).toHaveText('3일 지연');
});

test('작업 표는 날짜와 시간을 생략 없이 한 줄로 표시하고 타임라인은 작업당 한 번씩 Tab 이동한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await seed(page, 'list');
  const firstStart = page.getByRole('table', { name: '정렬된 작업 목록' }).locator('tbody tr').first().locator('time').first();
  await expect(firstStart.locator('.task-date-day')).toHaveText('2026.10.20');
  await expect(firstStart.locator('.task-date-clock')).toHaveText('09:00');
  await expect(firstStart).toHaveText('2026.10.20 09:00');
  const date = await firstStart.locator('.task-date-day').boundingBox();
  const time = await firstStart.locator('.task-date-clock').boundingBox();
  expect(Math.abs(time.y - date.y)).toBeLessThanOrEqual(2);
  await expect(firstStart).toHaveAttribute('datetime', '2026-10-20T09:00:00');
  await expect(firstStart).toHaveAttribute('aria-label', '2026. 10. 20. 09:00');
  const table = page.getByRole('region', { name: '작업 표', exact: true });
  expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('task-table-dates.png'), fullPage: true });
  await page.getByRole('button', { name: '타임라인', exact: true }).click();
  const titles = page.locator('.timeline-task-label .task-title-button');
  const secondTitle = await titles.nth(1).innerText();
  await titles.first().focus();
  await page.keyboard.press('Tab');
  await expect(titles.nth(1)).toBeFocused();
  await expect(timelinePreview(page)).toContainText(secondTitle);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: secondTitle, exact: true })).toBeVisible();
});


test('모바일 목록은 적용 조건 표시줄 없이 필터를 초기화하고 보기·월을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, 'list', '&mine=1&sort=newest&q=AI+피드백&status=REVISING&overdue=1&keep=1');
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  const filters = page.getByRole('group', { name: '적용 중인 검색·필터' });
  await expect(filters).toHaveCount(0);
  await page.getByRole('button', { name: '필터 · 5', exact: true }).click();
  await expect(page.getByLabel('작업 정렬')).toHaveValue('newest');
  await expect(page.getByLabel('내 담당 작업만')).toBeChecked();
  await expect(page.getByLabel('마감 지난 작업만')).toBeChecked();
  await page.getByRole('button', { name: '필터 · 5', exact: true }).click();
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toBeFocused();
  await expect(filters).toHaveCount(0);
  const params = new URL(page.url()).searchParams;
  expect(params.get('view')).toBe('list');
  expect(params.get('month')).toBe('2026-11');
  expect(params.get('keep')).toBe('1');
  for (const key of ['status', 'mine', 'q', 'overdue', 'due', 'sort', 'page'])
    expect(params.has(key)).toBe(false);
  await expect(page.getByRole('button', { name: '필터 초기화', exact: true })).toBeDisabled();
});


test('이전 캘린더 주소와 저장된 보기는 목록으로 전환하고 필터·상세 복귀를 유지한다', async ({ page }) => {
  await seed(page, 'calendar', '&q=AI+피드백&status=REVISING');
  const views = page.getByRole('group', { name: '작업 보기 방식' });
  await expect(views.getByRole('button')).toHaveText(['보드', '목록', '타임라인']);
  await expect(views.getByRole('button', { name: '목록', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/view=list&month=2026-11&q=.*&status=REVISING/);
  expect(new URL(page.url()).searchParams.get('q')).toBe('AI 피드백');
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('REVISING');
  const table = page.getByRole('table', { name: '정렬된 작업 목록' });
  await table.getByRole('button', { name: 'AI 피드백 화면 개선', exact: true }).click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(views.getByRole('button', { name: '목록', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).searchParams.get('q')).toBe('AI 피드백');
  await page.reload();
  await expect(page).toHaveURL(/view=list/);
  await page.evaluate(() => localStorage.setItem('fairplay:task-view-preferences', JSON.stringify({ view: 'calendar', labelWidth: 316 })));
  await page.goto('/preview/spaces/1/teams/1/tasks');
  await expect(views.getByRole('button', { name: '목록', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/view=list/);
  await views.getByRole('button', { name: '타임라인', exact: true }).click();
  await expect(page.getByRole('separator', { name: '작업명 영역 너비' })).toHaveCount(0);
  expect(await page.locator('.task-timeline-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
