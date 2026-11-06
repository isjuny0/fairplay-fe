import { test, expect } from '@playwright/test';
import { selectPreviewOption } from './helpers/previewControls.js';

const team = '/preview/spaces/1/teams/1';

for (const width of [320, 510, 720]) {
  test(`${width}px: 스페이스 선택·홈·팀 홈의 메뉴를 헤더에 통합하고 별도 영역을 제거한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/preview/main', '/preview/spaces/1', team]) {
      await page.goto(route);
      await expect(page.locator('main h1').first()).toBeVisible();
      const aside = page.locator('.space-directory-layout > aside, .workspace > aside');
      const header = page.getByLabel('현재 화면 정보');
      const button = page.locator('.mobile-header-navigation-slot').getByRole('button');
      await expect(header.locator('strong')).toHaveText(route === '/preview/main' ? '내 스페이스' : '2026 캡스톤디자인');
      await expect(aside).toBeHidden();
      expect((await page.locator('.topbar').boundingBox()).height).toBe(100);
      const box = await button.boundingBox();
      expect(box.x).toBe(width <= 360 ? 12 : 16);
      expect(box.width).toBe(36);
      expect(box.height).toBe(36);
      await button.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect((await page.getByRole('dialog').boundingBox()).height).toBeGreaterThan(400);
      expect((await page.locator('.topbar').boundingBox()).height).toBe(100);
      await page.keyboard.press('Escape');
    }
  });
}

for (const width of [320, 390, 720]) {
  test(`${width}px: 모바일 사이드 메뉴가 본문을 밀지 않고 초점을 가둔 뒤 복귀한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    if (width === 320) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(team);
    const heading = page.locator('main h1').first();
    await expect(heading).toBeVisible();
    const before = await heading.boundingBox();
    const trigger = page.getByRole('button', { name: '스페이스 메뉴 펼치기' });
    const buttonBox = await trigger.boundingBox();
    const glyphBox = await trigger.locator('.sidebar-toggle-glyph').boundingBox();
    expect(Math.abs(buttonBox.x + buttonBox.width / 2 - glyphBox.x - glyphBox.width / 2)).toBeLessThan(1);
    expect(Math.abs(buttonBox.y + buttonBox.height / 2 - glyphBox.y - glyphBox.height / 2)).toBeLessThan(1);
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: '스페이스 메뉴', exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: '회의록', exact: true })).toBeVisible();
    expect((await heading.boundingBox()).y).toBe(before.y);
    await expect(drawer.getByRole('button', { name: '메뉴 닫기' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    await expect(drawer.getByRole('button', { name: '메뉴 닫기' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('#root')).not.toHaveAttribute('inert');
    await trigger.click();
    await drawer.getByRole('button', { name: '회의록', exact: true }).click();
    await expect(page).toHaveURL(/meeting-minutes$/);
    await expect(drawer).not.toBeVisible();
    await expect(page.locator('#root')).not.toHaveAttribute('inert');
  });
}

test('스페이스 선택의 옆 메뉴도 바깥 클릭으로 닫히고 데스크톱에서는 기존 사이드바를 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview/main');
  const button = page.getByRole('button', { name: '스페이스 메뉴', exact: true });
  await expect(button).toHaveText('');
  const iconBox = await button.boundingBox();
  await expect(page.locator('.topbar .header-context-copy strong')).toHaveText('내 스페이스');
  const labelBox = await page.locator('.topbar .header-context-copy strong').boundingBox();
  const glyphBox = await button.locator('.sidebar-toggle-glyph').boundingBox();
  expect(iconBox.x).toBe(16);
  expect(iconBox.width).toBe(36);
  expect(iconBox.height).toBe(36);
  expect(Math.abs(iconBox.x + iconBox.width / 2 - glyphBox.x - glyphBox.width / 2)).toBeLessThan(1);
  expect(labelBox.x).toBe(iconBox.x);
  expect(labelBox.y).toBeGreaterThanOrEqual(iconBox.y + iconBox.height);
  await page.getByRole('button', { name: '스페이스 메뉴', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '내 스페이스 메뉴' })).toBeVisible();
  await page.locator('.mobile-drawer-backdrop').click({ position: { x: 380, y: 400 } });
  await expect(page.getByRole('dialog', { name: '내 스페이스 메뉴' })).not.toBeVisible();
  await page.getByRole('button', { name: '스페이스 메뉴', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '스페이스 보기' })).toBeVisible();
  await expect(page.locator('#root')).not.toHaveAttribute('inert');
});

for (const [view, selector] of [['board', '.board-task-card .task-title-button'], ['list', '.task-table tbody tr:first-child button'], ['timeline', '.timeline-row:not(.timeline-header) .timeline-task-label']]) {
  test(`390×844 ${view}: 첫 작업이 첫 화면에 보이고 검색과 필터를 함께 사용할 수 있다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${team}/tasks?view=${view}`);
    await expect(page.locator(selector).first()).toBeInViewport();
    const status = page.getByRole('group', { name: '작업 상태 선택' });
    const buttons = await status.getByRole('button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    expect(new Set(buttons).size).toBe(1);
    await page.getByRole('button', { name: /^필터(?: · \d+)?$/ }).click();
    await expect(page.getByRole('checkbox', { name: '내 담당 작업만' })).toBeVisible();
    await page.getByRole('checkbox', { name: '내 담당 작업만' }).check();
    await expect(page).toHaveURL(/mine=1/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('390×844: 첫 자료와 첫 관리자 팀이 보이고 보조 동작을 사용할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${team}/deliverables`);
  await expect(page.locator('.mobile-material-list > li').first()).toBeInViewport();
  const sort = await page.getByRole('combobox', { name: '자료 정렬' }).boundingBox();
  const filter = await page.locator('.deliverable-filter-toggle').boundingBox();
  expect(Math.abs(sort.y - filter.y)).toBeLessThan(8);
  await page.getByRole('button', { name: '자료에 질문하기', exact: true }).click();
  await expect(page).toHaveURL(/materials-search/);
  await page.goto('/preview/main');
  await selectPreviewOption(page, '미리보기 역할', 'manager');
  await page.goto('/preview/spaces/1/dashboard');
  await expect(page.locator('.dashboard-team-card .table-name-button').first()).toBeInViewport();
});

test('모바일 참여자는 필수 정보만 먼저 보이며 관리 제한은 펼친 뒤에도 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'manager'));
  await page.goto('/preview/spaces/1/participants');
  const rows = page.locator('.participant-table tbody tr');
  await expect(rows.nth(1)).toBeInViewport();
  const first = rows.first();
  await expect(first.getByRole('button', { name: /참여자 삭제/ })).not.toBeVisible();
  await first.getByText('가입 정보·관리').click();
  await expect(first.getByRole('button', { name: /참여자 삭제/ })).toBeDisabled();
  await expect(first.locator('.participant-mobile-details time')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(first.locator('.participant-advanced time')).toBeVisible();
  await expect(first.locator('.participant-mobile-details')).not.toBeVisible();
});

test('회의록의 참석자와 스페이스 일정은 펼쳐 확인하고 데스크톱에서는 바로 읽는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${team}/meeting-minutes/1`);
  await expect(page.locator('.meeting-attendee-chips')).not.toBeVisible();
  await page.locator('.meeting-attendees summary').click();
  await expect(page.locator('.meeting-attendee-chips')).toBeVisible();
  await page.goto('/preview/spaces/1');
  await expect(page.locator('.space-home-period-details')).not.toBeVisible();
  await page.locator('.space-schedule-disclosure summary').click();
  await expect(page.locator('.space-home-period-details')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.space-home-period-details')).toBeVisible();
  const overflow = await page.locator('.space-home-periods').evaluate(element => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
  for (const dates of await page.locator('.space-home-dates').all()) {
    expect(await dates.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect((await dates.boundingBox()).width).toBeGreaterThan(350);
  }
});

test('화면 키보드가 줄인 표시 영역에 작성 창을 맞춘다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    viewport.height = 844;
    viewport.offsetTop = 0;
    Object.defineProperty(window, 'visualViewport', { value: viewport });
  });
  await page.goto(`${team}/meeting-minutes`);
  await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').first().focus();
  await page.evaluate(() => { visualViewport.height = 500; visualViewport.dispatchEvent(new Event('resize')); });
  await expect(page.locator('body')).toHaveClass(/has-screen-keyboard/);
  expect((await dialog.boundingBox()).height).toBeLessThanOrEqual(484);
  await expect(dialog.getByRole('button', { name: '등록', exact: true })).toBeInViewport();
  await page.evaluate(() => { visualViewport.height = 844; visualViewport.dispatchEvent(new Event('resize')); });
  await expect(page.locator('body')).not.toHaveClass(/has-screen-keyboard/);
});

test('높이가 낮은 로그인에서는 설명을 접고 로그인 동작을 먼저 보여준다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto('/preview/login');
  await expect(page.locator('.login-benefits')).not.toBeVisible();
  await expect(page.locator('.google-button')).toBeInViewport();
  await page.locator('.login-benefits-disclosure summary').click();
  await expect(page.locator('.login-benefits')).toBeVisible();
});

test('알림 읽음 처리 후 전체 목록의 읽기 위치를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/preview/notifications');
  const first = page.locator('.personal-notification').first();
  await expect(first).toBeVisible();
  const y = (await first.boundingBox()).y;
  await first.getByRole('button', { name: /읽음으로 표시/ }).click();
  await expect(first.getByRole('button', { name: /읽음으로 표시/ })).toHaveCount(0);
  expect(Math.abs((await first.boundingBox()).y - y)).toBeLessThan(2);
});
