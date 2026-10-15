import { test, expect } from '@playwright/test';
import { getMockState } from '../../src/mock/planned.js';
import { previewContext } from '../../src/mock/preview.js';
import { currentTaskMonth } from '../../src/lib/taskSchedule.js';

async function seed(page, view = 'list', extra = '', customize = () => {}) {
  const state = structuredClone(getMockState(previewContext()));
  const dates = [
    '2026-10-31T15:00:00Z',
    '2026-10-31T14:59:00Z',
    '2026-11-12T00:00:00Z',
    '2026-11-12T02:00:00Z',
    '2026-11-12T04:00:00Z',
    '2026-11-12T06:00:00Z',
  ];
  state.teams[1].tasks.forEach((task, index) => {
    task.dueAt = dates[index];
    task.startAt = [
      '2026-10-30T00:00:00Z',
      '2026-10-20T00:00:00Z',
      '2026-10-28T00:00:00Z',
      dates[3],
      dates[4],
      '2026-11-10T00:00:00Z',
    ][index];
  });
  customize(state);
  await page.addInitScript((state) => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v5:preview:1', JSON.stringify(state));
  }, state);
  await page.goto(
    `/preview/spaces/1/teams/1/tasks?view=${view}&month=2026-11${extra}`,
  );
  await expect(
    page.getByRole('heading', { name: '작업', exact: true }),
  ).toBeVisible();
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
    '승인자',
    '예상 작업량',
    '시작일',
    '마감일',
  ]);
  await expect(table.getByRole('row')).toHaveCount(7);
  await page.screenshot({
    path: testInfo.outputPath('task-table.png'),
    fullPage: true,
  });
  await page.getByLabel('작업 제목 검색').fill('설문');
  await expect(table.getByRole('row')).toHaveCount(2);
  await table
    .getByRole('button', { name: '설문 결과 분석', exact: true })
    .click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
  await page.reload();
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('설문');
  await page.goBack();
  await expect(table).toBeVisible();
});

test('캘린더는 작업 기간을 이어 표시하고 날짜의 모든 작업에서 상세로 이동한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'calendar');
  const first = page.getByRole('cell', {
    name: '2026-11-01 작업 일정',
    exact: true,
  });
  await expect(
    first.getByRole('button', {
      name: '2026-11-01 작업 2개 모두 보기',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('table')
      .getByRole('button', { name: '설문 결과 분석', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('task-calendar.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: '2026-11-12 작업 4개 모두 보기', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: '2026-11-12 작업 일정' });
  await expect(dialog.locator('.schedule-task')).toHaveCount(4);
  await dialog.getByRole('button', { name: /최종 발표 자료/ }).click();
  await expect(
    page.getByRole('heading', { name: '최종 발표 자료', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page.getByLabel('조회 월')).toHaveValue('2026-11');
  await expect(
    page.getByRole('button', { name: '캘린더', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('캘린더 월 이동은 빈 달·연말·오늘과 URL 새로고침을 처리한다', async ({
  page,
}) => {
  await seed(page, 'calendar');
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '설문 결과 분석', exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel('조회 월').fill('2026-12');
  await expect(
    page.getByText('이 달에 예정된 작업이 없습니다.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(page.getByLabel('조회 월')).toHaveValue('2027-01');
  await page.reload();
  await expect(page.getByLabel('조회 월')).toHaveValue('2027-01');
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.getByLabel('조회 월')).toHaveValue(currentTaskMonth());
});

test('타임라인은 3개월의 계획 기간을 주 눈금으로 비교하고 상세 복귀·필터를 유지한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[3].status = 'IN_PROGRESS';
    state.teams[1].tasks[3].dueAt = '2026-12-10T00:00:00Z';
    state.teams[1].tasks[5].dueAt = '2027-01-12T00:00:00Z';
  });
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await expect(timeline.locator('.timeline-period')).toHaveCount(5);
  await expect(timeline.locator('.continues-before')).toHaveCount(2);
  await expect(
    timeline.getByRole('button', { name: '설문 결과 분석', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('task-timeline.png'),
    fullPage: true,
  });
  await timeline
    .getByRole('button', { name: '사용자 인터뷰 계획', exact: true })
    .click();
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '타임라인', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '이전 3개월', exact: true }).click();
  await expect(timeline.locator('.timeline-period')).toHaveCount(3);
  await page.getByLabel('작업 제목 검색').fill('없는 작업');
  await expect(timeline.locator('.timeline-period')).toHaveCount(0);
  await expect(
    page.getByText('이 기간에 예정되거나 지연 중인 작업이 없습니다.', {
      exact: false,
    }),
  ).toBeVisible();
});

for (const width of [1440, 320])
  test(`${width}px의 네 보기는 페이지 밖으로 넘치지 않고 직접 주소로 복원된다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    for (const [view, label] of [
      ['board', '보드'],
      ['list', '목록'],
      ['calendar', '캘린더'],
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
      if (view === 'list')
        await expect(
          page.getByRole('table', { name: '정렬된 작업 목록' }),
        ).toBeVisible();
      if (view === 'calendar' || view === 'timeline') {
        await page.getByRole('button', { name: '일정 넓게 보기', exact: true }).click();
        const expanded = page.getByRole('dialog', { name: '작업 일정 넓게 보기', exact: true });
        await expect(expanded).toBeVisible();
        const bounds = await expanded.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expanded.getByRole('button', { name: '닫기', exact: true }).click();
        await expect(expanded).toHaveCount(0);
      }
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
    '/preview/spaces/1/teams/1/tasks?view=calendar&month=invalid',
  );
  await expect(page.getByLabel('조회 월')).toHaveValue(currentTaskMonth());
});

test('3개월을 가로지르는 일정은 양쪽 연속 표시와 실제 기간을 유지한다', async ({
  page,
}) => {
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[0].startAt = '2026-10-31T14:59:00Z';
    state.teams[1].tasks[0].dueAt = '2027-02-01T00:00:00Z';
  });
  const bar = page.getByRole('button', { name: /사용자 인터뷰 계획 · 시작일/ });
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
    page.getByRole('heading', { name: '사용자 인터뷰 계획', exact: true }),
  ).toBeVisible();
});

test('캘린더는 중간 날짜·주 경계·마감 다음 날을 구분하고 숨긴 작업도 열 수 있다', async ({
  page,
}) => {
  await seed(page, 'calendar');
  await expect(
    page.getByRole('button', { name: '서비스 흐름 설계', exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole('button', { name: '2026-11-05 작업 1개 모두 보기', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /서비스 흐름 설계/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(
    page
      .getByRole('cell', { name: '2026-11-13 작업 일정', exact: true })
      .getByRole('button'),
  ).toHaveCount(0);
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
    state.teams[1].tasks[3].dueAt = '2026-12-01T00:00:00Z';
  });
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await expect(
    page.getByRole('heading', { name: '2026년 11월 – 2027년 1월' }),
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
    '설문 결과 분석',
    '서비스 흐름 설계',
    '사용자 인터뷰 계획',
    '조사 결과 요약',
    '프로토타입 사용성 검증',
    '최종 발표 자료',
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
  await page.getByRole('button', { name: '다음 3개월' }).click();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2027-02');
  await expect(timeline.locator('.timeline-today-label')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2026-11');
  await page.getByLabel('작업 정렬').selectOption('deadline');
  await expect(page.getByLabel('작업 정렬')).toHaveValue('deadline');
  await page.reload();
  await expect(page.getByLabel('작업 정렬')).toHaveValue('deadline');
});


test('타임라인 미리보기는 마우스·키보드로 확인하고 짧은 막대 주변도 선택할 수 있다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline');
  const bar = page.getByRole('button', { name: /프로토타입 사용성 검증 · 시작일/ });
  await bar.hover();
  const preview = page.getByRole('tooltip');
  await expect(preview).toContainText('프로토타입 사용성 검증');
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
  await expect(page.getByRole('heading', { name: '프로토타입 사용성 검증', exact: true })).toBeVisible();
});

test('타임라인은 긴 목록에서 월 헤더와 작업명을 고정하고 지연 집계로 필터링한다', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-15T09:00:00Z') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline', '', (state) => {
    const original = state.teams[1].tasks[0];
    for (let index = 0; index < 24; index++) {
      state.teams[1].tasks.push({ ...structuredClone(original), id: 1000 + index, title: `일정 검토 ${index + 1}`, startAt: '2026-11-01T00:00:00Z', dueAt: '2026-11-25T00:00:00Z' });
    }
  });
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await timeline.scrollIntoViewIfNeeded();
  await timeline.evaluate((element) => { element.scrollTop = 400; element.scrollLeft = 120; });
  const regionBounds = await timeline.boundingBox();
  const headerBounds = await timeline.locator('.timeline-header').boundingBox();
  const labelBounds = await timeline.locator('.timeline-header .timeline-task-label').boundingBox();
  expect(Math.abs(headerBounds.y - regionBounds.y - 1)).toBeLessThan(2);
  expect(Math.abs(labelBounds.x - regionBounds.x - 1)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('task-timeline-scroll.png'), fullPage: true });
  const lateFilter = page.getByRole('button', { name: /마감 지남 \d/ });
  await lateFilter.click();
  await expect(page.getByRole('checkbox', { name: '마감 지난 작업만', exact: true })).toBeChecked();
  await expect(lateFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(timeline.locator('.timeline-row:not(.timeline-header):not(.is-late)')).toHaveCount(0);
  await page.reload();
  await expect(lateFilter).toHaveAttribute('aria-pressed', 'true');
  await lateFilter.click();
  await expect(page.getByRole('checkbox', { name: '마감 지난 작업만', exact: true })).not.toBeChecked();
  await expect(timeline.locator('.timeline-row:not(.timeline-header)')).toHaveCount(30);
});


test('검색 결과와 현재 기간을 구분하고 적용한 검색·필터를 하나씩 해제한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T09:00:00Z') });
  await seed(page, 'timeline');
  await expect(page.locator('.list-summary')).toContainText('검색 결과 6개 · 전체 6개 · 현재 기간 5개');
  await page.getByLabel('작업 제목 검색').fill('설문');
  await page.getByLabel('작업 상태', { exact: true }).selectOption('IN_PROGRESS');
  await page.getByRole('checkbox', { name: '내 담당 작업만', exact: true }).check();
  await page.getByRole('checkbox', { name: '마감 지난 작업만', exact: true }).check();
  await page.getByLabel('작업 정렬').selectOption('newest');
  const chips = page.getByRole('group', { name: '적용 중인 검색·필터' });
  await expect(chips.getByRole('button')).toHaveCount(5);
  await chips.getByRole('button', { name: '검색: 설문 해제', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('');
  await page.reload();
  await expect(chips.getByRole('button')).toHaveCount(4);
  await chips.getByRole('button', { name: '상태: 진행 중 해제', exact: true }).click();
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('ALL');
  await expect(page.getByRole('checkbox', { name: '마감 지난 작업만', exact: true })).toBeChecked();
  for (const name of ['내 담당 해제', '마감 지남 해제', '정렬: 최근 생성 순 해제']) {
    await chips.getByRole('button', { name, exact: true }).click();
  }
  await expect(chips).toHaveCount(0);
  await expect(page.locator('.list-summary')).toContainText('현재 기간 5개');
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await expect(page.locator('.list-summary')).toContainText('검색 결과 6개 · 전체 6개 · 현재 기간 5개');
});

test('일정을 넓게 보고 작업명 너비를 조절해도 조회 조건을 유지하고 원래 크기로 복귀한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline');
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  const normalWidth = (await timeline.boundingBox()).width;
  const resizer = page.getByRole('separator', { name: '작업명 영역 너비' });
  await resizer.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resizer).toHaveAttribute('aria-valuenow', '316');
  const handle = await resizer.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 100, handle.y + handle.height / 2);
  await page.mouse.up();
  await expect(resizer).toHaveAttribute('aria-valuenow', '416');
  await page.getByRole('button', { name: '일정 넓게 보기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '작업 일정 넓게 보기', exact: true });
  await expect(dialog).toBeVisible();
  expect((await timeline.boundingBox()).width).toBeGreaterThan(normalWidth);
  await expect(resizer).toHaveAttribute('aria-valuenow', '416');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.getByLabel('작업 제목 검색').fill('서비스');
  await expect(page.locator('.list-summary')).toContainText('검색 결과 1개');
  await page.screenshot({ path: testInfo.outputPath('task-timeline-expanded.png') });
  const task = dialog.getByRole('button', { name: '서비스 흐름 설계', exact: true });
  await task.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '일정 넓게 보기', exact: true })).toBeFocused();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('서비스');
  await expect(resizer).toHaveAttribute('aria-valuenow', '416');
  await resizer.focus();
  await page.keyboard.press('Home');
  await expect(resizer).toHaveAttribute('aria-valuenow', '220');
  await page.keyboard.press('End');
  await expect(resizer).toHaveAttribute('aria-valuenow', '520');
  await resizer.dblclick();
  await expect(resizer).toHaveAttribute('aria-valuenow', '300');
});

test('마우스로 잠깐 지나친 작업은 미리보기를 열지 않고 키보드 초점은 즉시 표시한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-15T09:00:00Z') });
  await seed(page, 'timeline');
  await page.clock.pauseAt(new Date('2026-10-15T09:01:00Z'));
  const task = page.getByRole('button', { name: '서비스 흐름 설계', exact: true });
  await task.hover();
  await page.clock.runFor(150);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.clock.runFor(100);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await task.hover();
  await page.clock.runFor(220);
  await expect(page.getByRole('tooltip')).toContainText('서비스 흐름 설계');
  await page.keyboard.press('Escape');
  await task.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
});

test('작업 표는 가로·세로로 스크롤해도 열 제목과 작업 제목을 유지한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seed(page, 'list', '', (state) => {
    const original = state.teams[1].tasks[0];
    for (let index = 0; index < 24; index++) {
      state.teams[1].tasks.push({ ...structuredClone(original), id: 1000 + index, title: `검토 작업 ${index + 1}` });
    }
  });
  const table = page.getByRole('region', { name: '작업 표', exact: true });
  await table.scrollIntoViewIfNeeded();
  await table.evaluate((element) => { element.scrollTop = 400; element.scrollLeft = 150; });
  const bounds = await table.boundingBox();
  const corner = await table.getByRole('columnheader', { name: '작업', exact: true }).boundingBox();
  expect(Math.abs(corner.x - bounds.x - 1)).toBeLessThan(2);
  expect(Math.abs(corner.y - bounds.y - 1)).toBeLessThan(2);
  const firstTask = await table.locator('tbody th').first().boundingBox();
  expect(Math.abs(firstTask.x - bounds.x - 1)).toBeLessThan(2);
  expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('task-table-sticky.png') });
});


test('빈 달·기간에서 현재 검색과 담당 조건을 유지한 채 작업 있는 기간으로 이동한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'calendar');
  await page.getByLabel('작업 제목 검색').fill('서비스');
  await page.getByRole('checkbox', { name: '내 담당 작업만', exact: true }).check();
  for (const [label, input] of [['캘린더', '조회 월'], ['타임라인', '조회 시작 월']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByLabel(input, { exact: true }).fill('2032-01');
    await expect(page.locator('.list-summary')).toContainText('현재 기간 0개');
    await expect(page.getByText('검색 결과 1개의 작업은 다른 기간에 있습니다.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(label === '캘린더' ? 'task-calendar-empty.png' : 'task-timeline-empty.png'), fullPage: true });
    await page.getByRole('button', { name: '작업 있는 기간으로 이동', exact: true }).click();
    await expect(page.getByLabel(input, { exact: true })).toHaveValue('2026-11');
    await expect(page.getByLabel('작업 제목 검색')).toHaveValue('서비스');
    await expect(page.getByRole('checkbox', { name: '내 담당 작업만', exact: true })).toBeChecked();
    await expect(page.locator('.list-summary')).toContainText('현재 기간 1개');
  }
  const help = page.getByText('타임라인 읽는 법', { exact: true });
  await help.click();
  await expect(page.getByText('막대의 위치와 겹침으로 일정의 순서와 병행 구간을 비교합니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('기간 내 작업', { exact: false })).toHaveCount(0);
});

test('검색으로 빈 일정은 필터만 초기화하고 등록된 작업이 없으면 이동을 제안하지 않는다', async ({ page }) => {
  await seed(page, 'timeline');
  await page.getByLabel('조회 시작 월').fill('2032-01');
  await page.getByLabel('작업 제목 검색').fill('없는 작업');
  await expect(page.getByRole('button', { name: '작업 있는 기간으로 이동', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('');
  await expect(page.getByLabel('조회 시작 월')).toHaveValue('2032-01');
  await expect(page.getByRole('button', { name: '작업 있는 기간으로 이동', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('fairplay:mock:v5:preview:1'));
    state.teams[1].tasks = [];
    localStorage.setItem('fairplay:mock:v5:preview:1', JSON.stringify(state));
  });
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.getByText('아직 등록된 작업이 없습니다. 새 작업을 만들어 시작하세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '작업 있는 기간으로 이동', exact: true })).toHaveCount(0);
});

test('마지막 보기·너비는 재방문에 복원하고 주소의 보기·필터·월은 우선 적용한다', async ({ page }) => {
  await seed(page, 'timeline');
  const resizer = page.getByRole('separator', { name: '작업명 영역 너비' });
  await resizer.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resizer).toHaveAttribute('aria-valuenow', '316');
  await page.reload();
  await expect(resizer).toHaveAttribute('aria-valuenow', '316');
  await page.getByRole('button', { name: '팀 홈', exact: true }).click();
  await page.getByRole('button', { name: '작업', exact: true }).click();
  await expect(page.getByRole('button', { name: '타임라인', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(resizer).toHaveAttribute('aria-valuenow', '316');
  await page.goto('/preview/spaces/1/teams/1/tasks?view=calendar&month=2026-11&q=서비스&status=PENDING_APPROVAL');
  await expect(page.getByRole('button', { name: '캘린더', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('조회 월')).toHaveValue('2026-11');
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('서비스');
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('PENDING_APPROVAL');
  await page.goto('/preview/spaces/1/teams/1/tasks?month=2026-11');
  await expect(page.getByRole('button', { name: '캘린더', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('');
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('ALL');
  await expect(page).toHaveURL(/view=calendar/);
  await page.getByRole('button', { name: '보드', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('button', { name: '캘린더', exact: true })).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByRole('separator', { name: '작업명 영역 너비' })).toHaveAttribute('aria-valuenow', '300');
});

test('브라우저 설정 저장이 차단되어도 작업 조회·보기 전환·너비 조절이 가능하다', async ({ page }) => {
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
  const resizer = page.getByRole('separator', { name: '작업명 영역 너비' });
  await resizer.focus();
  await page.keyboard.press('ArrowRight');
  await expect(resizer).toHaveAttribute('aria-valuenow', '316');
  await page.getByRole('button', { name: '목록', exact: true }).click();
  await expect(page.getByRole('table', { name: '정렬된 작업 목록' })).toBeVisible();
});
