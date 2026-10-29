import { test, expect } from '@playwright/test';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

const team = '/preview/spaces/1/teams/1';

async function assertControl(control) {
  await expect(control).toBeVisible();
  await expect(control).toHaveCSS('border-radius', '6px');
  await expect(control).toHaveCSS('font-size', '14px');
  await expect(control).toHaveCSS('border-top-width', '1px');
  expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(36);
}

for (const width of [1440, 390, 320]) {
  test(`${width}px 회원·관리자 페이지의 선택 상자가 공통 스타일을 사용한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const manager = ['/preview/spaces/1/settings', '/preview/spaces/1/dashboard', '/preview/spaces/1/rounds', '/preview/spaces/1/reports'].includes(location.pathname);
      localStorage.setItem('fairplay:preview-role', manager ? 'manager' : 'leader');
    });
    for (const [role, routes] of [
      ['leader', ['/preview/main', team + '/tasks', team + '/deliverables', team + '/settings']],
      ['manager', ['/preview/spaces/1/settings', '/preview/spaces/1/dashboard', '/preview/spaces/1/rounds', '/preview/spaces/1/reports']],
    ]) {
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('main h1').first()).toBeVisible();
        for (const control of await page.locator('select:visible, .workspace-context-trigger:visible').all())
          await assertControl(control);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
      const preview = page.getByRole('region', { name: '미리보기 설정', exact: true });
      for (const control of await preview.locator('select').all()) await assertControl(control);
      await expect(page.getByLabel('미리보기 역할', { exact: true })).toHaveValue(role);
      await preview.getByRole('button', { name: '미리보기 설정 닫기', exact: true }).click();
    }
  });

  test(`${width}px 기본 선택 목록과 기존 커스텀 목록의 색·테두리를 통일한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(team + '/deliverables');
    const status = page.getByLabel('산출물 유형', { exact: true });
    await assertControl(status);
    const heading = await page.locator('main h1').boundingBox();
    await status.click();
    expect(await status.evaluate(el => el.tagName)).toBe('SELECT');
    expect(await status.evaluate(el => el.matches(':open'))).toBe(true);
    const picker = await status.evaluate(el => {
      const style = getComputedStyle(el, '::picker(select)');
      return { border: style.borderTopColor, background: style.backgroundColor, radius: style.borderRadius };
    });
    expect(picker).toEqual({ border: 'rgb(219, 225, 231)', background: 'rgb(255, 255, 255)', radius: '8px' });
    const chosen = page.getByRole('option', { name: '파일', exact: true });
    await expect(chosen).toHaveCSS('border-radius', '6px');
    await page.screenshot({ path: testInfo.outputPath('native-dropdown.png') });
    await chosen.click();
    await expect(status).toHaveValue('FILE');
    await expect(status).toHaveCSS('background-color', 'rgb(231, 244, 237)');
    expect(await page.locator('main h1').boundingBox()).toEqual(heading);
    await status.click();
    await page.keyboard.press('Escape');
    expect(await status.evaluate(el => el.matches(':open'))).toBe(false);
    await expect(status).toBeFocused();
    await page.reload();
    await expect(status).toHaveValue('FILE');

    await page.goto('/preview/main');
    const role = page.getByRole('combobox', { name: '내 역할 필터', exact: true });
    await role.click();
    const menu = page.getByRole('listbox', { name: '내 역할 필터', exact: true });
    await expect(menu).toHaveCSS('border-radius', '8px');
    await expect(menu).toHaveCSS('border-top-color', picker.border);
    await expect(menu).toHaveCSS('background-color', picker.background);
    await expect(menu.getByRole('option').first()).toHaveCSS('min-height', '36px');
    await page.screenshot({ path: testInfo.outputPath('context-dropdown.png') });
    await role.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(role).toBeFocused();
  });

  test(`${width}px 작업 모달과 일정 내부의 선택도 동일 스타일이며 레이아웃을 밀지 않는다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-10-21T09:00:00Z'));
    await page.goto(team + '/tasks');
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    const workload = editor.getByLabel('예상 작업량', { exact: true });
    await assertControl(workload);
    const originalBox = await editor.boundingBox();
    await workload.click();
    await page.screenshot({ path: testInfo.outputPath('modal-dropdown.png') });
    expect(await editor.boundingBox()).toEqual(originalBox);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(workload).toHaveValue('8');
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: '닫기', exact: true }).click();
    await page.getByRole('dialog', { name: '입력 내용 버리기', exact: true })
      .getByRole('button', { name: '버리고 닫기', exact: true }).click();
    await page.goto(team);
    await openCalendarEventEditor(page);
    const calendar = page.getByRole('dialog', { name: '일정 추가', exact: true });
    await calendar.getByRole('button', { name: '날짜 선택', exact: true }).click();
    const dates = calendar.getByRole('region', { name: '날짜 선택', exact: true });
    await dates.getByRole('tab', { name: '반복', exact: true }).click();
    const frequency = dates.getByLabel('반복 유형', { exact: true });
    await assertControl(frequency);
    const calendarBox = await calendar.boundingBox();
    await frequency.click();
    expect(await calendar.boundingBox()).toEqual(calendarBox);
    await page.getByRole('option', { name: '매주', exact: true }).click();
    await expect(frequency).toHaveValue('weekly');
    await expect(dates).toBeVisible();
    await dates.getByRole('button', { name: '선택한 날짜 적용', exact: true }).click();
    await calendar.getByRole('button', { name: '카테고리: 회의', exact: true }).click();
    const category = calendar.locator('.team-calendar-category-dropdown');
    await expect(category).toHaveCSS('border-radius', '8px');
    await expect(category).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await category.getByRole('radio', { name: '리뷰', exact: true }).click();
    await expect(category).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('기본 선택 상자의 비활성·필수 검증 스타일을 유지한다', async ({ page }) => {
  await page.goto(team + '/tasks');
  const status = page.getByLabel('작업 상태', { exact: true });
  await status.evaluate(el => el.disabled = true);
  await expect(status).toBeDisabled();
  await expect(status).toHaveCSS('background-color', 'rgb(248, 249, 250)');
  await expect(status).toHaveCSS('cursor', 'not-allowed');
  await status.evaluate(el => { el.disabled = false; el.setAttribute('aria-invalid', 'true'); });
  await expect(status).toHaveCSS('border-top-color', 'rgb(216, 59, 69)');
  await status.focus();
  await expect(status).toHaveCSS('outline-color', 'rgb(8, 124, 85)');
});
