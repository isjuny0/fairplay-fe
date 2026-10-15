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
