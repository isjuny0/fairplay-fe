import { test, expect } from '@playwright/test';
import {
  addDashboardWidgets,
  openCalendarEventEditor,
} from './helpers/teamDashboard.js';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
  await page.goto('/preview/spaces/1/teams/1');
});
async function begin(page, title, mode) {
  await openCalendarEventEditor(page);
  await page
    .getByRole('dialog', { name: '일정 추가', exact: true })
    .getByLabel('일정 이름', { exact: true })
    .fill(title);
  await page.getByRole('button', { name: '날짜 선택', exact: true }).click();
  const picker = page.getByRole('region', { name: '날짜 선택', exact: true });
  await picker.getByRole('tab', { name: mode, exact: true }).click();
  return picker;
}
async function save(page, picker) {
  await picker
    .getByRole('button', { name: '선택한 날짜 적용', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: '일정 추가', exact: true })
    .getByRole('button', { name: '일정 저장', exact: true })
    .click();
  await page
    .locator('.team-calendar-day-dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click();
}
test('기간·다중·주간 반복은 선택한 날짜에 표시되고 다시 열어도 유지된다', async ({
  page,
}) => {
  let picker = await begin(page, '프로젝트 집중 기간', '기간');
  await picker
    .getByRole('button', { name: '선택한 날짜 적용', exact: true })
    .click();
  await expect(picker.getByRole('alert')).toContainText('종료 날짜');
  await picker
    .getByRole('button', { name: '2026년 10월 13일', exact: true })
    .click();
  await picker
    .getByRole('button', { name: '2026년 10월 18일', exact: true })
    .click();
  await expect(picker.locator('.is-in-range')).toHaveCount(6);
  await save(page, picker);
  const calendar = page.getByRole('region', { name: '직접 등록 일정 캘린더' });
  await expect(calendar.locator('.team-calendar-label')).toHaveCount(0);
  await expect(calendar.locator('.team-calendar-event-dot')).toHaveCount(2);
  await expect(
    calendar.getByRole('button', {
      name: '2026년 10월 15일, 일정 1개',
      exact: true,
    }),
  ).toBeVisible();

  picker = await begin(page, '매주 팀 회의', '반복');
  await picker
    .getByRole('button', { name: '반복 시작 날짜', exact: true })
    .click();
  await picker
    .getByRole('button', { name: '2026년 10월 21일', exact: true })
    .click();
  const weekdays = picker.getByRole('group', {
    name: '반복 요일',
    exact: true,
  });
  for (const name of ['일', '월', '화', '수', '목', '금', '토']) {
    const button = weekdays.getByRole('button', {
      name: `${name}요일`,
      exact: true,
    });
    const expected = ['월', '수'].includes(name);
    if (((await button.getAttribute('aria-pressed')) === 'true') !== expected)
      await button.click();
  }
  await picker.getByLabel('종료일 없음', { exact: true }).uncheck();
  await picker
    .getByRole('button', { name: '반복 종료 날짜', exact: true })
    .click();
  await picker.getByRole('button', { name: '다음 달', exact: true }).click();
  await picker
    .getByRole('button', { name: '2026년 11월 4일', exact: true })
    .click();
  await save(page, picker);

  picker = await begin(page, '개별 인터뷰', '다중');
  await picker
    .getByRole('button', { name: '2026년 10월 21일', exact: true })
    .click();
  await picker
    .getByRole('button', { name: '선택한 날짜 적용', exact: true })
    .click();
  await expect(picker.getByRole('alert')).toContainText('한 개 이상');
  await picker
    .getByRole('button', { name: '2026년 10월 5일', exact: true })
    .click();
  await picker
    .getByRole('button', { name: '2026년 10월 12일', exact: true })
    .click();
  await save(page, picker);
  await page.reload();
  await expect(
    calendar.getByRole('button', {
      name: '2026년 10월 5일, 일정 1개',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    calendar.getByRole('button', {
      name: '2026년 10월 8일, 일정 0개',
      exact: true,
    }),
  ).toBeVisible();
  await calendar.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(
    calendar.getByRole('button', {
      name: '2026년 11월 2일, 일정 1개',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    calendar.getByRole('button', {
      name: '2026년 11월 4일, 일정 1개',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    calendar.getByRole('button', {
      name: '2026년 11월 9일, 일정 0개',
      exact: true,
    }),
  ).toBeVisible();
  await calendar.getByRole('button', { name: '이전 달', exact: true }).click();
  await calendar
    .getByRole('button', { name: '2026년 10월 15일, 일정 1개', exact: true })
    .click();
  await page
    .getByRole('button', { name: '프로젝트 집중 기간 일정 수정', exact: true })
    .click();
  await expect(
    page.getByText('수정·삭제하면 이 일정의 모든 날짜에 함께 적용돼요.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: '일정 수정', exact: true })
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '일정 삭제', exact: true }),
  ).toContainText('일정 전체');
  await page
    .getByRole('dialog', { name: '일정 삭제', exact: true })
    .getByRole('button', { name: '삭제', exact: true })
    .click();
  await page
    .locator('.team-calendar-day-dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click();
  await expect(
    calendar.getByRole('button', {
      name: '2026년 10월 15일, 일정 0개',
      exact: true,
    }),
  ).toBeVisible();
});

test('모바일에서 매월·매년 반복과 종료일 없음이 저장된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const picker = await begin(page, '기념 일정', '반복');
  await picker.getByLabel('반복 유형', { exact: true }).selectOption('monthly');
  await picker
    .getByRole('button', { name: '반복 시작 날짜', exact: true })
    .click();
  await picker
    .getByRole('button', { name: '2026년 10월 31일', exact: true })
    .click();
  await expect(picker).toContainText('매월 31일');
  await picker.getByLabel('반복 유형', { exact: true }).selectOption('yearly');
  await expect(picker).toContainText('매년 10월 31일');
  await expect(picker.getByLabel('종료일 없음', { exact: true })).toBeChecked();
  expect(
    await picker.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await save(page, picker);
  await page
    .getByRole('button', { name: '2026년 10월 31일, 일정 1개', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '기념 일정 일정 수정', exact: true }),
  ).toContainText('매년 10.31');
});

test('기본·추가 위젯을 드래그하고 화살표로 이동하며 제거·복원이 저장된다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await addDashboardWidgets(page, ['빠른 메모']);
  await page.getByRole('button', { name: '위젯 편집', exact: true }).click();
  await page
    .getByRole('button', { name: '캘린더 위젯 드래그', exact: true })
    .dragTo(page.locator('[data-widget-id="contribution"]'));
  expect(
    await page
      .locator('[data-widget-id]')
      .evaluateAll((els) => els.map((el) => el.dataset.widgetId)),
  ).toEqual(['progress', 'contribution', 'calendar', 'memo']);
  await page
    .getByRole('button', { name: '빠른 메모 위젯 드래그', exact: true })
    .dragTo(page.locator('[data-widget-id="progress"]'));
  await page
    .getByRole('button', { name: '팀 전체 진행률 뒤로 이동', exact: true })
    .click();
  expect(
    await page
      .locator('[data-widget-id]')
      .evaluateAll((els) => els.map((el) => el.dataset.widgetId)),
  ).toEqual(['memo', 'contribution', 'progress', 'calendar']);
  await page
    .getByRole('button', { name: '내 기여도 위젯 제거', exact: true })
    .click();
  await page.getByRole('button', { name: '편집 완료', exact: true }).click();
  await page.reload();
  await expect(page.locator('[data-widget-id]')).toHaveCount(3);
  expect(
    await page
      .locator('[data-widget-id]')
      .evaluateAll((els) => els.map((el) => el.dataset.widgetId)),
  ).toEqual(['memo', 'progress', 'calendar']);
  await addDashboardWidgets(page, ['내 기여도']);
  await expect(page.locator('[data-widget-id="contribution"]')).toBeVisible();
});
