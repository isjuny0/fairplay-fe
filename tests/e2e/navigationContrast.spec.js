import { test, expect } from '@playwright/test';

function luminance(color) {
  const values = color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((value) => value / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('사이드바는 세 그룹의 모든 메뉴를 한 번에 표시하고 현재 위치를 유지한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/preview/spaces/1/teams/1');
  const menus = page.getByRole('navigation', { name: '팀 메뉴', exact: true });
  await expect(menus.locator('.nav-section')).toHaveText([
    '팀 작업',
    '평가·리포트',
    '팀 관리',
  ]);
  await expect(menus.getByRole('button')).toHaveCount(9);
  for (const label of [
    '팀 홈',
    '작업',
    '산출물',
    '승인 검토',
    '동료 평가',
    '중간 피드백',
    '기여도 리포트',
    '팀원 관리',
    '팀 설정',
  ]) {
    await expect(
      menus.getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  }
  const settings = await menus
    .getByRole('button', { name: '팀 설정', exact: true })
    .boundingBox();
  expect(settings.y + settings.height).toBeLessThanOrEqual(800);
  const labelsFit = await page
    .locator('.workspace-context-copy > small')
    .evaluateAll((elements) =>
      elements.every(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          element.clientHeight < 22,
      ),
    );
  expect(labelsFit).toBe(true);
  await menus.getByRole('button', { name: '중간 피드백', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/mid-feedback$/);
  await page.reload();
  await expect(
    menus.getByRole('button', { name: '중간 피드백', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(menus.locator('[aria-current="page"]')).toHaveCount(1);
});

test('목록 선택은 디자인과 선택 표시를 유지하고 취소하면 현재 화면을 보존한다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1/tasks');
  const trigger = page.getByRole('combobox', {
    name: '스페이스 선택',
    exact: true,
  });
  await trigger.click();
  const list = page.getByRole('listbox', {
    name: '스페이스 선택',
    exact: true,
  });
  const selected = list.getByRole('option', { selected: true });
  await expect(selected).toContainText('2026 서비스 디자인 프로젝트');
  await expect(selected.locator('svg')).toBeVisible();
  expect(
    await selected
      .locator('span')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(list).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(selected).toHaveCSS('color', 'rgb(8, 124, 85)');
  await expect(page.locator('.workspace-selectors select')).toHaveCount(0);
  const currentUrl = page.url();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await selected.click();
  await expect(page).toHaveURL(currentUrl);
  await trigger.click();
  await page.getByRole('heading', { name: '작업', exact: true }).click();
  await expect(list).toBeHidden();
});

test('공간·팀 선택과 이전 사이드바 메뉴의 좌우 여백을 맞춘다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/preview/main');
  await expect(page.locator('.directory-sidebar-link').first()).toBeVisible();
  const directory = await page
    .locator('.directory-sidebar-link')
    .first()
    .boundingBox();
  const directoryPadding = await page
    .locator('.space-directory-sidebar')
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.paddingTop, style.paddingLeft, style.paddingRight];
    });
  await page.goto('/preview/spaces/1/teams/1');
  await expect(page.locator('.workspace-back-link')).toBeVisible();
  const workspace = await page.locator('.workspace-back-link').boundingBox();
  const workspacePadding = await page
    .locator('.workspace-sidebar')
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.paddingTop, style.paddingLeft, style.paddingRight];
    });
  expect(workspacePadding).toEqual(directoryPadding);
  expect(workspace.x).toBe(directory.x);
  expect(workspace.width).toBe(directory.width);
  expect(
    await page
      .locator('.workspace-back-link')
      .evaluate((el) => getComputedStyle(el).paddingLeft),
  ).toBe('12px');
  for (const picker of await page.locator('.workspace-context-trigger').all()) {
    const box = await picker.boundingBox();
    expect(box.x).toBe(workspace.x);
    expect(box.width).toBe(workspace.width);
  }
});

test('팀 목록은 키보드로 이동하고 관리자의 자료 조회 권한을 유지한다', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('fairplay:preview-role', 'manager'),
  );
  await page.goto('/preview/spaces/1/dashboard');
  const trigger = page.getByRole('combobox', { name: '팀 선택', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/teams\/1\/members$/);
  await expect(trigger).toHaveAttribute('data-value', '1');
  await trigger.click();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('listbox', { name: '팀 선택', exact: true }),
  ).toBeHidden();
});

test('선택 메뉴와 상태 배지는 연한 배경·진한 글씨로 구분하고 실행 버튼은 초록색을 유지한다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1/tasks');
  const selected = page.locator('.workspace-sidebar .nav-item.active');
  await expect(selected).toHaveCSS('background-color', 'rgb(231, 244, 237)');
  await expect(selected).toHaveCSS('color', 'rgb(8, 124, 85)');
  const primary = page.locator('.task-board-page .primary-button').first();
  await expect(primary).toHaveCSS('background-color', 'rgb(8, 124, 85)');
  for (const locator of [selected, primary]) {
    const colors = await locator.evaluate((element) => ({
      text: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
    }));
    expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
  const palette = await page.evaluate(() => {
    const names = ['todo', 'in_progress', 'pending_approval', 'done'];
    return names.map((name) => {
      const element = document.createElement('span');
      element.className = `status-badge task-state-${name}`;
      document.querySelector('.task-board-page').append(element);
      const style = getComputedStyle(element);
      const colors = { text: style.color, background: style.backgroundColor };
      element.remove();
      return colors;
    });
  });
  expect(new Set(palette.map((colors) => colors.background)).size).toBe(4);
  for (const colors of palette)
    expect(colors.text).not.toBe('rgb(255, 255, 255)');
  for (const colors of palette)
    expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(
      4.5,
    );
});

test('팀 홈의 마감·승인 대기는 각각 빨간색과 노란색 아이콘으로 표시한다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1');
  for (const [name, background] of [['.home-overdue-icon', 'rgb(255, 240, 241)'], ['.home-pending-icon', 'rgb(255, 244, 194)']]) {
    const icon = page.locator(name);
    await expect(icon).toHaveCSS('background-color', background);
    await expect(icon.locator('svg')).toBeVisible();
  }
  await expect(page.locator('.home-overdue-icon')).toHaveCSS(
    'color',
    'rgb(255, 85, 92)',
  );
  await expect(page.locator('.home-pending-icon')).toHaveCSS(
    'color',
    'rgb(234, 179, 8)',
  );
  await expect(
    page.locator('.has-overdue .home-action-title strong'),
  ).toHaveCSS('color', 'rgb(8, 124, 85)');
});

test('타임라인·캘린더·목록은 밝은 상태 배경과 읽기 쉬운 글씨색을 공유한다', async ({
  page,
}) => {
  const palette = [
    ['todo', 'rgb(191, 233, 250)', 'rgb(0, 92, 186)'],
    ['in_progress', 'rgb(231, 244, 237)', 'rgb(8, 124, 85)'],
    ['pending_approval', 'rgb(255, 244, 194)', 'rgb(128, 91, 0)'],
    ['done', 'rgb(237, 241, 245)', 'rgb(83, 97, 116)'],
  ];
  await page.goto('/preview/spaces/1/teams/1/tasks?view=board');
  for (const [status, color] of [
    ['todo', 'rgb(0, 181, 232)'],
    ['in_progress', 'rgb(8, 124, 85)'],
    ['pending_approval', 'rgb(234, 179, 8)'],
    ['done', 'rgb(148, 163, 184)'],
  ]) {
    await expect(page.locator(`.task-column.task-state-${status} .status-dot`)).toHaveCSS('background-color', color);
  }
  await page.getByRole('button', { name: '타임라인', exact: true }).click();
  for (const [status, background, text] of palette) {
    for (const selector of ['.timeline-period', '.timeline-task-state']) {
      const item = page.locator(`${selector}.schedule-task-${status}`).first();
      await expect(item).toBeVisible();
      await expect(item).toHaveCSS('background-color', background);
      await expect(item).toHaveCSS('color', text);
    }
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  }
  await expect(
    page.locator('.timeline-row.is-late .timeline-period').first(),
  ).toHaveCSS('border-bottom-color', 'rgb(255, 85, 92)');
  await page.getByRole('button', { name: '목록', exact: true }).click();
  for (const [status, background, text] of palette) {
    const badge = page
      .locator(`.task-table .status-badge.task-state-${status}`)
      .first();
    await expect(badge).toHaveCSS('background-color', background);
    await expect(badge).toHaveCSS('color', text);
  }
  const overdue = page.locator('.task-table .is-overdue').first();
  await expect(overdue).toHaveCSS('color', 'rgb(255, 85, 92)');
  await expect(overdue).toHaveCSS('background-color', 'rgb(255, 240, 241)');
  await expect(page.locator('.task-table td:has(> .is-overdue) > time').first()).toHaveCSS('color', 'rgb(255, 85, 92)');
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  for (const [status, background, text] of palette) {
    const period = page
      .locator(`.calendar-period.schedule-task-${status}`)
      .first();
    await expect(period).toHaveCSS('background-color', background);
    await expect(period).toHaveCSS('color', text);
  }
});

for (const role of ['member', 'manager', 'participant']) {
  test(`${role} 역할의 메뉴 권한을 유지한다`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('fairplay:preview-role', value),
      role,
    );
    await page.goto(
      role === 'participant'
        ? '/preview/spaces/1'
        : role === 'manager'
          ? '/preview/spaces/1/dashboard'
          : '/preview/spaces/1/teams/1',
    );
    const sidebar = page.getByRole('navigation', {
      name: '스페이스 메뉴',
      exact: true,
    });
    await expect(
      sidebar.getByRole('button', { name: '팀 목록', exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('button', { name: '관리자 대시보드', exact: true }),
    ).toHaveCount(role === 'manager' ? 1 : 0);
    if (role === 'participant')
      await expect(
        sidebar.getByRole('navigation', { name: '팀 메뉴', exact: true }),
      ).toHaveCount(0);
    if (role === 'member')
      await expect(
        sidebar
          .getByRole('navigation', { name: '팀 메뉴', exact: true })
          .getByRole('button'),
      ).toHaveCount(9);
  });
}

for (const width of [768, 390, 320]) {
  test(`${width}px 사이드바 선택과 모바일 이동에 가로 잘림이 없다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1');
    if (width <= 720) {
      await page.getByRole('button', { name: /공간·팀 선택/ }).click();
      await expect(page.getByLabel('팀 선택', { exact: true })).toBeVisible();
      await page
        .getByRole('combobox', { name: '스페이스 선택', exact: true })
        .click();
      const list = page.getByRole('listbox', {
        name: '스페이스 선택',
        exact: true,
      });
      const box = await list.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect(
        list.getByRole('option', { selected: true }),
      ).toBeInViewport();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /공간·팀 선택/ }).click();
      await page
        .getByRole('navigation', { name: '모바일 팀 메뉴', exact: true })
        .getByRole('button', { name: '작업', exact: true })
        .click();
      await expect(page).toHaveURL(/\/tasks(?:\?|$)/);
    } else {
      await page
        .getByRole('navigation', { name: '팀 메뉴', exact: true })
        .getByRole('button', { name: '산출물', exact: true })
        .click();
      await expect(page).toHaveURL(/\/deliverables$/);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}
