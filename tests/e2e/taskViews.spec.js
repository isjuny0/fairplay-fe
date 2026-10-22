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
    localStorage.setItem('fairplay:mock:v7:preview:1', JSON.stringify(state));
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

test('캘린더는 미완료 기간 막대와 날짜 옆 완료 점을 표시하고 날짜 작업의 상세로 이동한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'calendar');
  const monthHeading = await page.getByRole('heading', { name: '2026년 11월', exact: true }).boundingBox();
  for (const name of ['이전 달', '다음 달']) {
    const arrow = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(Math.abs(monthHeading.y + monthHeading.height / 2 - arrow.y - arrow.height / 2)).toBeLessThanOrEqual(1);
  }
  const controls = await page.locator('.task-schedule-controls').boundingBox();
  const calendar = await page.getByRole('region', { name: '월간 작업 일정', exact: true }).boundingBox();
  expect(calendar.y - controls.y - controls.height).toBeLessThanOrEqual(56);
  await expect(
    page.locator('.calendar-period'),
  ).not.toHaveCount(0);
  const markers = page.getByRole('button', {
    name: '2026-11-12 작업 4개 보기',
    exact: true,
  });
  await expect(page.getByRole('cell', { name: '2026-11-12 작업 일정', exact: true }).locator('.calendar-date-marker')).toHaveCount(3);
  await expect(page.locator('.calendar-date-marker:not(.schedule-task-done)')).toHaveCount(0);
  await expect(page.locator('.calendar-period.schedule-task-done')).toHaveCount(0);
  await expect(page.getByLabel('캘린더 상태 범례')).toContainText('할 일');
  await page.screenshot({ path: testInfo.outputPath('task-calendar-compact.png'), fullPage: true });
  const calendarHelp = page.getByLabel(/일정 읽는 법 도움말/);
  await calendarHelp.hover();
  await expect(calendarHelp.getByRole('tooltip')).toContainText('미완료 작업은 시작일부터 마감일까지');
  await expect(calendarHelp.getByRole('tooltip')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: testInfo.outputPath('task-calendar.png'),
    fullPage: true,
  });
  await markers.click();
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

test('캘린더 점의 미리보기는 작업별 정보와 키보드 초점을 제공하고 클릭은 날짜 목록을 연다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'calendar');
  const cell = page.getByRole('cell', { name: '2026-11-12 작업 일정', exact: true });
  const legend = page.getByLabel('캘린더 시작·마감 범례');
  await expect(legend).toContainText('시작');
  await expect(legend).toContainText('마감');
  const marker = page.getByRole('button', { name: '서비스 흐름 설계 · 작업 기간 · 수정 중', exact: true }).last();
  const preview = page.getByRole('tooltip').and(page.locator('.calendar-preview'));
  await expect(marker).toHaveText('');
  const periodStyle = await marker.evaluate((element) => ({
    lineHeight: getComputedStyle(element, '::before').height,
    lineEndRadius: getComputedStyle(element, '::before').borderTopRightRadius,
    lineShadow: getComputedStyle(element, '::before').boxShadow,
    lineHighlight: getComputedStyle(element, '::before').backgroundImage,
    lineBorder: getComputedStyle(element, '::before').borderTopStyle,
    lineStartWidth: getComputedStyle(element, '::before').borderLeftWidth,
    lineColor: getComputedStyle(element, '::before').backgroundColor,
    statusColor: getComputedStyle(element).getPropertyValue('--schedule-color').trim(),
    hitHeight: element.getBoundingClientRect().height,
  }));
  expect(periodStyle.lineHeight).toBe('10px');
  expect(periodStyle.lineEndRadius).toBe('3px');
  expect(periodStyle.lineShadow).toContain('inset');
  expect(periodStyle.lineHighlight).toContain('linear-gradient');
  expect(periodStyle.lineBorder).toBe('solid');
  expect(periodStyle.lineStartWidth).toBe('2px');
  expect(periodStyle.hitHeight).toBeGreaterThanOrEqual(22);
  await expect(marker.locator('..')).toHaveCSS('row-gap', '2px');
  expect(periodStyle.lineColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(periodStyle.statusColor).not.toBe('');
  await expect(page.locator('.calendar-period-endpoint')).toHaveCount(0);
  await expect(marker).toHaveCSS('opacity', '0.6');
  const sameDayPeriod = page.getByRole('button', { name: '프로토타입 사용성 검증 · 작업 기간 · 할 일', exact: true });
  await expect(sameDayPeriod).toBeVisible();
  await marker.hover();
  await expect(preview).toContainText('#103 서비스 흐름 설계');
  await expect(preview.locator('.calendar-preview-kind')).toHaveText('작업 기간');
  await expect(preview).toContainText('수정 중');
  await expect(preview).toContainText('담당');
  await expect(preview).toContainText('김하늘');
  await expect(preview).toContainText('2026. 10. 28. 09:00');
  await expect(preview).toContainText('2026. 11. 12. 09:00');
  await expect(marker).toHaveAttribute('aria-describedby', await preview.getAttribute('id'));
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  const other = cell.getByRole('button', { name: '최종 발표 자료 · 시작 · 완료', exact: true });
  const sameDayDue = cell.getByRole('button', { name: '최종 발표 자료 · 마감 · 완료', exact: true });
  await expect(other).toHaveClass(/is-start/);
  await expect(sameDayDue).toHaveClass(/is-due/);
  const startStyle = await other.evaluate((element) => ({ fill: getComputedStyle(element, '::before').backgroundColor, stroke: getComputedStyle(element, '::before').borderTopColor }));
  const dueStyle = await sameDayDue.evaluate((element) => ({ fill: getComputedStyle(element, '::before').backgroundColor, stroke: getComputedStyle(element, '::before').borderTopColor }));
  expect(startStyle.fill).toBe('rgba(0, 0, 0, 0)');
  expect(dueStyle.fill).toBe(dueStyle.stroke);
  expect(startStyle.stroke).toBe(dueStyle.stroke);
  const dateBounds = await cell.locator('time').boundingBox();
  const markerBounds = await other.boundingBox();
  expect(markerBounds.x).toBeGreaterThanOrEqual(dateBounds.x + dateBounds.width);
  expect(Math.abs(markerBounds.y + markerBounds.height / 2 - dateBounds.y - dateBounds.height / 2)).toBeLessThanOrEqual(1);
  await other.focus();
  await expect(preview).toContainText('#105 최종 발표 자료');
  await expect(preview.locator('.calendar-preview-kind')).toHaveText('시작 일정');
  await expect(preview).not.toContainText('서비스 흐름 설계');
  await page.screenshot({ path: testInfo.outputPath('calendar-marker-preview.png') });
  await sameDayDue.focus();
  await expect(preview.locator('.calendar-preview-kind')).toHaveText('마감 일정');
  await expect(other).not.toHaveAttribute('aria-describedby');
  await expect(sameDayDue).toHaveAttribute('aria-describedby', await preview.getAttribute('id'));
  await sameDayDue.click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '2026-11-12 작업 일정', exact: true })).toBeVisible();
});

test('캘린더 점을 스쳐 지나치면 미리보기를 열지 않고 조회 조건 변경 시 닫는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-01T09:00:00Z') });
  await seed(page, 'calendar');
  await page.clock.pauseAt(new Date('2026-11-01T09:01:00Z'));
  const marker = page.getByRole('button', { name: '서비스 흐름 설계 · 작업 기간 · 수정 중', exact: true }).last();
  const preview = page.getByRole('tooltip').and(page.locator('.calendar-preview'));
  await marker.hover();
  await page.clock.runFor(150);
  await expect(preview).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.clock.runFor(100);
  await expect(preview).toHaveCount(0);
  await marker.hover();
  await page.clock.runFor(220);
  await expect(preview).toContainText('서비스 흐름 설계');
  await page.getByLabel('작업 제목 검색').fill('프로토타입');
  await expect(preview).toHaveCount(0);
  await expect(marker).toHaveCount(0);
  const other = page.getByRole('button', { name: '프로토타입 사용성 검증 · 작업 기간 · 할 일', exact: true });
  await other.focus();
  await expect(preview).toContainText('프로토타입 사용성 검증');
  await page.getByLabel('조회 월', { exact: true }).fill('2026-12');
  await expect(preview).toHaveCount(0);
});

test('좁은 캘린더의 점 미리보기는 화면 안에 표시되고 스크롤·화면 크기 변경 시 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, 'calendar');
  const marker = page.getByRole('button', { name: '서비스 흐름 설계 · 작업 기간 · 수정 중', exact: true }).last();
  const preview = page.getByRole('tooltip').and(page.locator('.calendar-preview'));
  await marker.focus();
  await expect(preview).toContainText('서비스 흐름 설계');
  const bounds = await preview.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(12);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(378);
  expect(bounds.y).toBeGreaterThanOrEqual(12);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(832);
  await page.getByRole('region', { name: '월간 작업 일정', exact: true }).evaluate((element) => { element.scrollLeft += 60; });
  await expect(preview).toHaveCount(0);
  await page.keyboard.press('Escape');
  await marker.blur();
  await marker.focus();
  await expect(preview).toBeVisible();
  await page.setViewportSize({ width: 400, height: 844 });
  await expect(preview).toHaveCount(0);
});

test('캘린더 월 이동은 빈 달·연말·오늘과 URL 새로고침을 처리한다', async ({
  page,
}) => {
  await seed(page, 'calendar');
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expect(page.locator('.calendar-date-marker').first()).toBeVisible();
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
    state.teams[1].tasks[3].dueAt = '2026-12-10T09:00:00';
    state.teams[1].tasks[5].dueAt = '2027-01-12T09:00:00';
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
    state.teams[1].tasks[0].startAt = '2026-10-31T23:59:00';
    state.teams[1].tasks[0].dueAt = '2027-02-01T09:00:00';
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

test('캘린더는 완료 작업 점과 미완료 작업 기간을 구분하고 날짜 목록을 연다', async ({
  page,
}) => {
  await seed(page, 'calendar');
  await expect(page.locator('.calendar-period')).not.toHaveCount(0);
  await expect(page.locator('.calendar-period.schedule-task-done')).toHaveCount(0);
  await page
    .getByRole('button', { name: '2026-11-12 작업 4개 보기', exact: true })
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

test('월 전체를 가로지르는 미완료 작업은 주별로 연결하고 완료 작업은 양 끝 날짜에만 표시한다', async ({ page }) => {
  await seed(page, 'calendar', '', (state) => {
    const tasks = state.teams[1].tasks;
    state.teams[1].tasks = [tasks[1], tasks[0]].map((task) => ({ ...task, startAt: '2026-10-01T09:00:00', dueAt: '2026-12-01T18:00:00' }));
  });
  await expect(page.locator('.list-summary')).toContainText('현재 기간 1개');
  const bars = page.getByRole('button', { name: '설문 결과 분석 · 작업 기간 · 진행 중', exact: true });
  await expect(bars).toHaveCount(5);
  await expect(bars.first()).toHaveClass(/continues-before/);
  await expect(bars.last()).toHaveClass(/continues-after/);
  await expect(bars.locator('.calendar-period-endpoint')).toHaveCount(0);
  await expect(page.locator('.calendar-date-marker')).toHaveCount(0);
  await page.getByRole('button', { name: '2026-11-15 작업 1개 보기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '2026-11-15 작업 일정', exact: true });
  await expect(dialog.locator('.schedule-task')).toHaveCount(1);
  await expect(dialog).toContainText('설문 결과 분석');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await bars.first().click();
  await expect(page.getByRole('heading', { name: '설문 결과 분석', exact: true })).toBeVisible();
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
  await expect(page.getByLabel('타임라인 상태 범례')).toContainText('진행 중');
  const timelineHelp = page.getByLabel(/일정 읽는 법 도움말/);
  await timelineHelp.hover();
  await expect(timelineHelp.getByRole('tooltip')).toContainText('빨간 빗금');
  await expect(timelineHelp.getByRole('tooltip')).toHaveCSS('opacity', '1');
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
  const preview = timelinePreview(page);
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
      state.teams[1].tasks.push({ ...structuredClone(original), id: 1000 + index, title: `일정 검토 ${index + 1}`, startAt: '2026-11-01T09:00:00', dueAt: '2026-11-25T09:00:00' });
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
  await expect(timelinePreview(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(timelinePreview(page)).toHaveCount(0);
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
  await expect(timelinePreview(page)).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.clock.runFor(100);
  await expect(timelinePreview(page)).toHaveCount(0);
  await task.hover();
  await page.clock.runFor(220);
  await expect(timelinePreview(page)).toContainText('서비스 흐름 설계');
  await page.keyboard.press('Escape');
  await task.focus();
  await expect(timelinePreview(page)).toBeVisible();
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
  const help = page.getByLabel(/일정 읽는 법 도움말/);
  const tooltip = help.getByRole('tooltip');
  await help.hover();
  await expect(tooltip).toContainText('막대의 위치와 겹침으로 일정의 순서와 병행 구간을 비교합니다.');
  await expect(tooltip).toHaveCSS('opacity', '1');
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCSS('opacity', '0');
  await help.focus();
  await expect(tooltip).toHaveCSS('opacity', '1');
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
    const state = JSON.parse(localStorage.getItem('fairplay:mock:v7:preview:1'));
    state.teams[1].tasks = [];
    localStorage.setItem('fairplay:mock:v7:preview:1', JSON.stringify(state));
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
  await page.goto('/preview/spaces/1/teams/1/tasks?view=calendar&month=2026-11&q=서비스&status=REVISING');
  await expect(page.getByRole('button', { name: '캘린더', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('조회 월')).toHaveValue('2026-11');
  await expect(page.getByLabel('작업 제목 검색')).toHaveValue('서비스');
  await expect(page.getByLabel('작업 상태', { exact: true })).toHaveValue('REVISING');
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


test('열어 둔 타임라인은 분마다 지연을 갱신하고 창·탭 복귀 시 현재 시각을 반영한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T14:59:30Z') });
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks.forEach((task) => { task.status = 'DONE'; });
    Object.assign(state.teams[1].tasks[0], { status: 'IN_PROGRESS', startAt: '2026-11-14T09:00:00', dueAt: '2026-11-15T23:59:50' });
  });
  const late = page.getByRole('button', { name: /마감 지남 \d/ });
  await expect(late).toHaveText('마감 지남 0');
  await page.clock.runFor(60000);
  await expect(late).toHaveText('마감 지남 1');
  const row = page.locator('.timeline-row').filter({ has: page.getByRole('button', { name: '사용자 인터뷰 계획', exact: true }) });
  await expect(row.locator('.timeline-late-label')).toHaveText('마감 지남');
  await page.clock.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row.locator('.timeline-late-label')).toHaveText('2일 지연');
  await page.clock.setSystemTime(new Date('2026-11-18T15:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(row.locator('.timeline-late-label')).toHaveText('3일 지연');
});

test('캘린더의 오늘 표시는 화면을 열어 둔 채 날짜가 바뀌어도 갱신된다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T14:59:30Z') });
  await seed(page, 'calendar');
  await expect(page.getByRole('cell', { name: '2026-11-15 작업 일정', exact: true }).locator('time')).toHaveAttribute('aria-current', 'date');
  await page.clock.runFor(60000);
  await expect(page.getByRole('cell', { name: '2026-11-16 작업 일정', exact: true }).locator('time')).toHaveAttribute('aria-current', 'date');
  await expect(page.getByRole('cell', { name: '2026-11-15 작업 일정', exact: true }).locator('time')).not.toHaveAttribute('aria-current', 'date');
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


test('접힌 모바일 필터의 조건을 해제하면 필터 버튼으로 복귀하고 초기화는 보기·월을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, 'list', '&mine=1&sort=newest&q=설문&keep=1');
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  const filters = page.getByRole('group', { name: '적용 중인 검색·필터' });
  await filters.getByRole('button', { name: '정렬: 최근 생성 순 해제', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '필터 · 2', exact: true })).toBeFocused();
  expect(new URL(page.url()).searchParams.get('sort')).toBeNull();
  expect(new URL(page.url()).searchParams.get('mine')).toBe('1');
  await filters.getByRole('button', { name: '검색: 설문 해제', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toBeFocused();
  await page.getByRole('button', { name: '검색·필터 초기화', exact: true }).click();
  await expect(page.getByLabel('작업 제목 검색')).toBeFocused();
  await expect(filters).toHaveCount(0);
  const params = new URL(page.url()).searchParams;
  expect(params.get('view')).toBe('list');
  expect(params.get('month')).toBe('2026-11');
  expect(params.get('keep')).toBe('1');
  expect(params.has('mine')).toBe(false);
});
