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
      null,
      '2026-11-10T00:00:00Z',
    ][index];
  });
  customize(state);
  await page.addInitScript((state) => {
    localStorage.setItem('fairplay:preview-role', 'leader');
    localStorage.setItem('fairplay:mock:v4:preview:1', JSON.stringify(state));
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

test('캘린더는 KST 날짜를 적용하고 같은 날 네 작업을 모두 열어 상세로 이동한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'calendar');
  const first = page.getByRole('cell', {
    name: '2026-11-01 마감 작업',
    exact: true,
  });
  await expect(
    first.getByRole('button', { name: '사용자 인터뷰 계획', exact: true }),
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
  const dialog = page.getByRole('dialog', { name: '2026-11-12 마감 작업' });
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
    page
      .getByRole('cell', { name: '2026-10-31 마감 작업', exact: true })
      .getByRole('button', { name: '설문 결과 분석', exact: true }),
  ).toBeVisible();
  await page.getByLabel('조회 월').fill('2026-12');
  await expect(
    page.getByText('이 달에 마감되는 작업이 없습니다.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(page.getByLabel('조회 월')).toHaveValue('2027-01');
  await page.reload();
  await expect(page.getByLabel('조회 월')).toHaveValue('2027-01');
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.getByLabel('조회 월')).toHaveValue(currentTaskMonth());
});

test('타임라인은 월에 겹치는 계획 기간과 시작일 미설정 작업의 마감을 표시한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, 'timeline');
  const timeline = page.getByRole('region', { name: '작업 계획 타임라인' });
  await expect(timeline.locator('.timeline-period')).toHaveCount(4);
  await expect(timeline.locator('.timeline-marker')).toHaveCount(1);
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
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expect(timeline.locator('.timeline-period')).toHaveCount(3);
  await expect(timeline.locator('.timeline-marker')).toHaveCount(0);
  await page.getByLabel('작업 제목 검색').fill('없는 작업');
  await expect(timeline.locator('.timeline-marker')).toHaveCount(0);
  await expect(
    page.getByText('이 달에 예정된 작업이 없습니다.', { exact: false }),
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

test('한 달 전체를 가로지르는 일정은 양쪽 연속 표시와 실제 기간을 유지한다', async ({
  page,
}) => {
  await seed(page, 'timeline', '', (state) => {
    state.teams[1].tasks[0].startAt = '2026-10-31T14:59:00Z';
    state.teams[1].tasks[0].dueAt = '2026-12-01T00:00:00Z';
  });
  const bar = page.getByRole('button', { name: /사용자 인터뷰 계획 · 시작일/ });
  await expect(bar).toHaveClass(/continues-before continues-after/);
  await expect(bar).toHaveCSS('grid-column-start', '2');
  await expect(bar).toHaveCSS('grid-column-end', '32');
  await expect(bar).toHaveAccessibleName(
    /2026\. 10\. 31\. 23:59.*2026\. 12\. 01\. 09:00/,
  );
  await bar.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: '사용자 인터뷰 계획', exact: true }),
  ).toBeVisible();
});
