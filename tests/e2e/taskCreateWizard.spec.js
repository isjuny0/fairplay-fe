import { test, expect } from '@playwright/test';

for (const width of [1440, 900, 390, 320]) {
  test(`${width}px 새 작업은 고정 크기로 내용·배분 두 단계를 거쳐 저장한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    const firstBox = await dialog.boundingBox();
    await expect(dialog.getByRole('list', { name: '작업 입력 단계', exact: true }).locator('li')).toHaveText(['1작업 내용', '2담당자 배분']);
    await expect(dialog.getByRole('region', { name: '담당·배분 설정 입력', exact: true })).not.toBeVisible();
    await expect(dialog.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByLabel('작업 제목', { exact: true })).toBeFocused();
    await dialog.getByLabel('작업 제목', { exact: true }).fill(`두 단계 작업 ${width}`);
    await dialog.getByLabel('작업 설명', { exact: true }).fill('작업 내용과 일정을 입력한 뒤 배분합니다.');
    await dialog.getByRole('textbox', { name: '시작일 날짜', exact: true }).fill('2030-12-01');
    await dialog.getByRole('textbox', { name: '마감 날짜', exact: true }).fill('2030-12-02');
    await page.screenshot({ path: testInfo.outputPath('task-create-content.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: '담당자·담당 비율', exact: true })).toBeFocused();
    expect(await dialog.boundingBox()).toEqual(firstBox);
    await expect(dialog.getByRole('region', { name: '작업 내용 입력', exact: true })).not.toBeVisible();
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog.getByText('담당자를 한 명 이상 선택해 주세요.', { exact: true })).toBeVisible();
    if (width === 1440) {
      await dialog.getByRole('button', { name: '작업량 기준 자동 선택', exact: true }).click();
      await expect(dialog.getByText('1명을 선택했습니다. 담당자와 담당 비율을 조정할 수 있습니다.', { exact: true })).toBeVisible();
      await expect(dialog.locator('.allocation-member input:checked')).toHaveCount(1);
      await dialog.locator('.allocation-member input:checked').uncheck();
    }
    await dialog.getByRole('checkbox', { name: '김하늘 · 리더', exact: true }).check();
    await dialog.getByRole('checkbox', { name: '이지원 · 팀원', exact: true }).check();
    await expect(dialog.getByLabel('김하늘 배분율', { exact: true })).toHaveValue('50');
    await expect(dialog.getByLabel('이지원 배분율', { exact: true })).toHaveValue('50');
    await dialog.getByLabel('김하늘 배분율', { exact: true }).fill('70');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog.getByText(/현재 합계는 120%/)).toBeVisible();
    await dialog.getByLabel('이지원 배분율', { exact: true }).fill('30');
    await dialog.getByRole('button', { name: '이전', exact: true }).click();
    await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveValue(`두 단계 작업 ${width}`);
    expect(await dialog.boundingBox()).toEqual(firstBox);
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByLabel('김하늘 배분율', { exact: true })).toHaveValue('70');
    await expect(dialog.getByLabel('이지원 배분율', { exact: true })).toHaveValue('30');
    expect(await dialog.boundingBox()).toEqual(firstBox);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('task-create-allocation.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: `두 단계 작업 ${width}`, exact: true })).toBeVisible();
  });
}

test('낮은 모바일 화면도 크기·이동·날짜 및 도움말 닫기 색상을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/preview/spaces/1/teams/1/tasks');
  await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
  const original = await dialog.boundingBox();
  const next = dialog.getByRole('button', { name: '다음', exact: true });
  const footer = await next.boundingBox();
  expect(footer.y + footer.height).toBeLessThanOrEqual(500);
  await dialog.getByRole('button', { name: '예상 작업량과 담당 비율 도움말', exact: true }).click();
  const help = page.getByRole('button', { name: '도움말 닫기', exact: true });
  await expect(help).not.toHaveCSS('background-color', 'rgb(229, 36, 52)');
  await expect(help).toHaveCSS('color', 'rgb(85, 97, 112)');
  await help.click();
  await dialog.getByRole('button', { name: '시작일 달력 열기', exact: true }).click();
  const calendarClose = page.getByRole('button', { name: '달력 닫기', exact: true });
  await expect(calendarClose).toHaveCSS('background-color', 'rgb(229, 36, 52)');
  await calendarClose.click();
  expect(await dialog.boundingBox()).toEqual(original);
});
