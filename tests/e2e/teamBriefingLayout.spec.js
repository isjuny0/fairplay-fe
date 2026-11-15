import { test, expect } from '@playwright/test';

const homePath = '/preview/spaces/1/teams/1';

for (const width of [1920, 1440, 1024, 768, 390, 320]) {
  test(`${width}px 팀 소식은 세로 목록 아래 오른쪽에 버튼을 모아 표시한다`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(homePath);
    const card = page.getByRole('region', { name: '팀 변경 브리핑', exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { level: 2 })).toHaveText('새로운 변경이 5건 있어요.');
    await expect(card.getByRole('list', { name: '주요 소식', exact: true }).getByRole('listitem')).toHaveCount(2);
    await expect(card).toContainText('주요 소식 2건을 먼저 보여드려요.');
    await expect(card).toHaveCSS('background-image', 'linear-gradient(118deg, rgb(252, 251, 255), rgb(250, 250, 254))');
    await expect(card).toHaveCSS('border-radius', '16px');
    await expect(card.getByRole('heading', { level: 2 })).toHaveCSS('font-size', width <= 600 ? '16px' : '18px');
    await expect(card.locator('.team-briefing-item-icon').first()).toHaveCSS('height', '40px');
    const actions = card.locator('footer.team-briefing-actions');
    await expect(actions.getByRole('button')).toHaveCount(2);
    await expect(card.locator('.team-briefing-heading button, .team-briefing-chevron')).toHaveCount(0);

    const items = await card.locator('.team-briefing-highlights > li').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
    expect(items[1].top).toBeGreaterThanOrEqual(items[0].bottom);
    expect(items[1].left).toBeCloseTo(items[0].left, 0);
    expect(await card.locator('button').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 34))).toBe(true);
    await expect(actions.getByRole('button').first()).toHaveCSS('border-radius', '7px');
    await expect(actions.getByRole('button').first()).toHaveCSS('font-size', '12px');
    await expect(card.locator('.team-briefing-acknowledge')).toHaveCSS('background-color', 'rgb(244, 249, 246)');
    const details = await card.locator('.team-briefing-details').boundingBox();
    const actionBox = await actions.boundingBox();
    expect(actionBox.y).toBeGreaterThanOrEqual(details.y + details.height);
    const buttons = await actions.getByRole('button').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
    expect(buttons[1].right).toBeCloseTo(actionBox.x + actionBox.width, 0);
    if (width > 360) expect(buttons[1].top).toBeCloseTo(buttons[0].top, 0);
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const toggle = card.getByRole('button', { name: '모든 변경 보기', exact: true });
    await toggle.focus();
    await toggle.press('Enter');
    await expect(card.getByRole('list', { name: '추가 변경', exact: true }).getByRole('listitem')).toHaveCount(3);
    await expect(card.getByRole('button', { name: '간략히 보기', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(card.locator('.team-briefing-time')).toHaveCount(5);
    const expandedDetails = await card.locator('.team-briefing-details').boundingBox();
    expect((await actions.boundingBox()).y).toBeGreaterThanOrEqual(expandedDetails.y + expandedDetails.height);
    await card.getByRole('button', { name: '간략히 보기', exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(card.getByRole('list', { name: '추가 변경', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('team-briefing-vertical.png'), animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}

test('개별 확인 후 돌아오면 펼친 상태와 남은 건수를 유지하고 모두 확인을 저장한다', async ({ page }) => {
  await page.goto(homePath);
  const card = page.getByRole('region', { name: '팀 변경 브리핑', exact: true });
  await card.getByRole('button', { name: '모든 변경 보기', exact: true }).click();
  const firstLink = card.getByRole('link').first();
  const href = await firstLink.getAttribute('href');
  const openedTitle = await firstLink.locator('strong').innerText();
  await firstLink.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await page.goBack();
  await expect(card.getByRole('button', { name: '간략히 보기', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(card.getByRole('heading', { level: 2 })).toHaveText('새로운 변경이 4건 있어요.');
  await expect(card.getByRole('link').filter({ hasText: openedTitle })).toHaveCount(0);
  await card.getByRole('button', { name: '4건 모두 확인했어요', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '새로운 변경 사항을 모두 확인했어요.' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.team-dashboard')).toBeVisible();
  await expect(card).toHaveCount(0);
});

for (const width of [1440, 320]) {
  test(`${width}px 긴 작업 제목과 변경 설명도 생략하거나 잘리지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(homePath);
    await expect(page.locator('.team-briefing-card')).toBeVisible();
    const title = '공동 프로젝트의 권한과 다양한 화면에서의 접근성을 검증하는 아주 긴 작업 제목';
    const description = '팀원들의 검토 의견을 반영하기 위해 작업이 수정 중으로 변경되었으며 전체 내용을 확인할 수 있어요.';
    await page.evaluate(async ({ title, description }) => {
      const { previewContext } = await import('/src/mock/preview.js');
      const { getMockState, saveMockState } = await import('/src/mock/planned.js');
      const context = previewContext();
      const state = getMockState(context);
      state.teamBriefingEvents[1][0].title = title;
      state.teamBriefingEvents[1][0].changeDescription = description;
      saveMockState(context, state);
    }, { title, description });
    await page.reload();
    const card = page.locator('.team-briefing-card');
    await expect(card.locator('strong').first()).toHaveText(title);
    await expect(card.locator('.team-briefing-change-description').first()).toHaveText(description);
    expect(await card.locator('.team-briefing-item-link, strong, .team-briefing-change-description').evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
