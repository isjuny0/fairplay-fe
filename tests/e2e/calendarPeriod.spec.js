import { test, expect } from '@playwright/test';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
  await page.goto('/preview/spaces/1/teams/1');
});

for (const width of [1920, 1440, 768, 390, 320]) {
  test(`${width}px 캘린더 날짜 칸은 과하게 늘어나지 않고 월·연도 목록을 같은 방식으로 선택한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const calendar = page.getByRole('region', {
      name: '직접 등록 일정 캘린더',
      exact: true,
    });
    const checkSquares = async (locator) => {
      const boxes = await locator.evaluateAll((elements) =>
        elements.map((el) => {
          const box = el.getBoundingClientRect();
          return { width: box.width, height: box.height };
        }),
      );
      expect(boxes.length).toBeGreaterThan(27);
      for (const box of boxes)
        expect(Math.min(box.width, box.height)).toBeGreaterThan(12);
    };
    await expect(
      calendar.getByRole('heading', { name: '2026년 10월', exact: true }),
    ).toBeVisible();
    const checkCalendarCells = async () => {
      const boxes = await calendar
        .locator('.team-calendar-grid > button')
        .evaluateAll((elements) =>
          elements.map((el) => {
            const { width, height } = el.getBoundingClientRect();
            return { width, height };
          }),
        );
      for (const box of boxes) {
        expect(box.height).toBeGreaterThanOrEqual(46);
        expect(box.width / box.height).toBeLessThanOrEqual(2.5);
      }
      const face = await calendar
        .locator('.team-calendar-square-face')
        .boundingBox();
      const gridBox = await calendar
        .locator('.team-calendar-grid')
        .boundingBox();
      expect(Math.abs(face.width - gridBox.width)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(face.y + face.height - gridBox.y - gridBox.height),
      ).toBeLessThanOrEqual(1);
    };
    await checkCalendarCells();
    const todayNumber = calendar.locator(
      '[data-date="2026-10-21"] .team-calendar-day-number',
    );
    const otherDay = calendar.locator('[data-date="2026-10-13"]');
    await otherDay.click();
    await page
      .locator('.team-calendar-day-dialog')
      .getByRole('button', { name: '닫기', exact: true })
      .click();
    await expect(todayNumber).toHaveCSS('background-color', 'rgb(8, 124, 85)');
    await expect(otherDay.locator('.team-calendar-day-number')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(calendar.locator('[aria-current="date"]')).toHaveCount(1);
    await calendar
      .getByRole('button', { name: '월 목록 보기', exact: true })
      .click();
    await expect(
      calendar
        .getByRole('group', { name: '2026년 월 선택', exact: true })
        .getByRole('button'),
    ).toHaveCount(12);
    await expect(
      calendar.getByRole('button', { name: '연도 목록 보기', exact: true }),
    ).toHaveText('2026');
    await calendar
      .getByRole('button', { name: '연도 목록 보기', exact: true })
      .click();
    await expect(
      calendar
        .getByRole('group', {
          name: '2017년부터 2028년까지 연도 선택',
          exact: true,
        })
        .getByRole('button'),
    ).toHaveCount(12);
    await calendar
      .getByRole('button', { name: '다음 연도 범위', exact: true })
      .click();
    await expect(
      calendar.getByRole('button', { name: '2030년', exact: true }),
    ).toBeVisible();
    await calendar
      .getByRole('button', { name: '이전 연도 범위', exact: true })
      .click();
    await calendar.getByRole('button', { name: '2027년', exact: true }).click();
    await calendar
      .getByRole('button', { name: '2027년 2월', exact: true })
      .click();
    await expect(calendar.locator('.team-calendar-grid')).toHaveAttribute(
      'aria-label',
      '2027년 2월 날짜',
    );
    await checkCalendarCells();
    await expect(
      calendar.getByRole('button', { name: '오늘', exact: true }),
    ).toHaveCount(0);
    await expect(
      calendar.getByRole('button', { name: '일정 추가', exact: true }),
    ).toHaveCount(0);
    await expect(calendar.locator('.calendar-period-count')).toHaveCount(0);
    await openCalendarEventEditor(page);
    const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
    await editor
      .getByRole('button', { name: '날짜 선택', exact: true })
      .click();
    const picker = page.getByRole('region', { name: '날짜 선택', exact: true });
    await checkSquares(picker.locator('.team-calendar-picker-grid > button'));
    await picker
      .getByRole('button', { name: '월 목록 보기', exact: true })
      .click();
    await picker
      .getByRole('button', { name: '연도 목록 보기', exact: true })
      .click();
    await picker.getByRole('button', { name: '2028년', exact: true }).click();
    await picker
      .getByRole('button', { name: '2028년 2월', exact: true })
      .click();
    await picker
      .getByRole('button', { name: '2028년 2월 29일', exact: true })
      .click();
    await picker
      .getByRole('button', { name: '선택한 날짜 적용', exact: true })
      .click();
    await expect(
      editor.getByRole('button', { name: '날짜 선택', exact: true }),
    ).toContainText('2월 29일');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}

for (const width of [1440, 390, 320]) {
  test(`${width}px 시간 입력의 위·아래 선과 날짜 스타일이 일치하고 팀 홈 경로만 제거한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator('.workspace-breadcrumb')).toHaveCount(0);
    await openCalendarEventEditor(page);
    const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
    await editor.getByText('시간·메모 추가', { exact: true }).click();
    const start = editor.getByLabel('시작 시간', { exact: true });
    const end = editor.getByLabel('종료 시간', { exact: true });
    const left = await start.boundingBox(),
      right = await end.boundingBox();
    expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
    expect(left.height).toBe(right.height);
    for (const input of [
      start,
      end,
      editor.getByRole('button', { name: '날짜 선택', exact: true }),
    ]) {
      await expect(input).toHaveCSS('background-color', 'rgb(244, 247, 245)');
      await expect(input).toHaveCSS('border-radius', '9px');
      expect((await input.boundingBox()).height).toBe(41);
    }
    await start.fill('13:00');
    await end.fill('14:00');
    await editor
      .getByRole('button', { name: '시작 시간 선택 열기', exact: true })
      .click();
    const timePicker = editor.getByRole('region', {
      name: '시간 선택',
      exact: true,
    });
    await expect(timePicker).toBeVisible();
    const hour = timePicker.getByRole('button', { name: '09시', exact: true });
    await hour.click();
    await timePicker.getByRole('button', { name: '30분', exact: true }).click();
    await expect(hour).toHaveCSS('background-color', 'rgb(230, 243, 235)');
    await timePicker
      .getByRole('button', { name: '시간 적용', exact: true })
      .click();
    await expect(start).toHaveValue('09:30');
    await editor
      .getByRole('button', { name: '종료 시간 선택 열기', exact: true })
      .click();
    await expect(timePicker).toBeVisible();
    const bounds = await timePicker.boundingBox();
    expect(
      Math.abs(bounds.width - (await end.boundingBox()).width),
    ).toBeLessThanOrEqual(1);
    await expect(timePicker).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(timePicker).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(end).toHaveValue('14:00');
    await editor.getByRole('button', { name: '취소', exact: true }).click();
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await expect(page.locator('.workspace-breadcrumb')).toContainText('작업');
  });
}

for (const width of [1440, 1920]) {
  test(`${width}px 진행률과 기여도의 보기 버튼은 같은 높이에 표시한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const board = page.getByRole('button', {
      name: '작업 보드 보기',
      exact: true,
    });
    const report = page.getByRole('button', {
      name: '리포트 보기',
      exact: true,
    });
    await expect(board).toBeVisible();
    await expect(report).toBeVisible();
    const a = await board.boundingBox(),
      b = await report.boundingBox();
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
    const asOf = await page
      .locator('.dashboard-team-progress > time')
      .boundingBox();
    expect(asOf.y + asOf.height).toBeLessThan(a.y);
  });
}
