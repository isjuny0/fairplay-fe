import { expect } from '@playwright/test';
export async function clickDashboardControl(page, name) {
  const control = page.getByRole('button', { name, exact: true });
  if (!(await control.isVisible())) await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  await control.click();
}
export async function openCalendarEventEditor(page) {
  const calendar = page.getByRole('region', {
    name: '직접 등록 일정 캘린더',
    exact: true,
  });
  await calendar
    .locator('.team-calendar-grid > button[aria-pressed="true"]')
    .click();
  await page
    .locator('.team-calendar-day-dialog')
    .getByRole('button', { name: '새 일정 추가', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: '일정 추가', exact: true })
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
}

export async function addDashboardWidgets(page, titles) {
  await clickDashboardControl(page, '위젯 추가');
  const catalog = page.getByRole('dialog', { name: '위젯 추가', exact: true });
  for (const title of titles) {
    const added = catalog.getByRole('button', { name: `${title} 제거`, exact: true });
    if (await added.count()) { await expect(added).toHaveAttribute('aria-pressed', 'true'); await expect(added).toBeEnabled(); continue; }
    const button = catalog.getByRole('button', { name: `${title} 추가`, exact: true });
    await button.click();
    await expect(added).toBeEnabled();
  }
  await expect(
    page.getByRole('button', { name: '화면 설정', exact: true }),
  ).toBeEnabled();
  await catalog.getByRole('button', { name: '완료', exact: true }).click();
}

export async function selectCalendarEventDate(page, date) {
  await page.getByRole('button', { name: '날짜 선택', exact: true }).click();
  const picker = page.getByRole('region', { name: '날짜 선택', exact: true });
  const [year, month, day] = date.split('-').map(Number);
  const current = await picker
    .locator('.team-calendar-picker-grid')
    .getAttribute('data-month');
  const [currentYear, currentMonth] = current.split('-').map(Number);
  const offset = (year - currentYear) * 12 + month - currentMonth;
  for (let i = 0; i < Math.abs(offset); i++)
    await picker
      .getByRole('button', {
        name: offset > 0 ? '다음 달' : '이전 달',
        exact: true,
      })
      .click();
  await picker
    .getByRole('button', { name: `${year}년 ${month}월 ${day}일`, exact: true })
    .click();
  await picker
    .getByRole('button', { name: '선택한 날짜 적용', exact: true })
    .click();
}
