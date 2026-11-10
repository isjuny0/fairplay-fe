import { test, expect } from '@playwright/test';

for (const width of [1440, 900, 720, 390, 320]) {
  test(`${width}px 새 작업은 내용·계획·배분 3단계로 입력을 보존하고 저장한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    const firstBox = await dialog.boundingBox();
    await expect(dialog.getByRole('list', { name: '작업 입력 단계', exact: true }).locator('li')).toHaveText(['1작업 내용', '2작업 계획', '3담당자 배분']);
    await expect(dialog.getByLabel('예상 작업량', { exact: true })).toBeHidden();
    await expect(dialog.getByRole('region', { name: '담당·배분 설정 입력', exact: true })).not.toBeVisible();
    await expect(dialog.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
    const description = await dialog.getByLabel('작업 설명', { exact: true }).boundingBox();
    expect(description.height).toBeGreaterThan(200);
    expect(await dialog.locator('.modal-body').evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByLabel('작업 제목', { exact: true })).toBeFocused();
    await dialog.getByLabel('작업 제목', { exact: true }).fill(`세 단계 작업 ${width}`);
    await dialog.getByLabel('작업 설명', { exact: true }).fill('작업 내용과 일정을 입력한 뒤 배분합니다.');
    {
      await dialog.getByRole('button', { name: '다음', exact: true }).click();
      await expect(dialog.getByRole('heading', { name: '작업 계획', exact: true })).toBeFocused();
      await expect(dialog.getByLabel('작업 제목', { exact: true })).toBeHidden();
      expect(await dialog.boundingBox()).toEqual(firstBox);
    }
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
    await dialog.getByRole('checkbox', { name: '김준영 · 리더', exact: true }).check();
    await dialog.getByRole('checkbox', { name: '김영진 · 팀원', exact: true }).check();
    await expect(dialog.getByLabel('김준영 배분율', { exact: true })).toHaveValue('50');
    await expect(dialog.getByLabel('김영진 배분율', { exact: true })).toHaveValue('50');
    await dialog.getByLabel('김준영 배분율', { exact: true }).fill('70');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog.getByText(/현재 합계는 120%/)).toBeVisible();
    await dialog.getByLabel('김영진 배분율', { exact: true }).fill('30');
    await dialog.getByRole('button', { name: '이전', exact: true }).click();
    {
      await expect(dialog.getByLabel('마감 날짜', { exact: true })).toHaveValue('2030-12-02');
      await dialog.getByRole('button', { name: '이전', exact: true }).click();
    }
    await expect(dialog.getByLabel('작업 제목', { exact: true })).toHaveValue(`세 단계 작업 ${width}`);
    expect(await dialog.boundingBox()).toEqual(firstBox);
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByLabel('김준영 배분율', { exact: true })).toHaveValue('70');
    await expect(dialog.getByLabel('김영진 배분율', { exact: true })).toHaveValue('30');
    expect(await dialog.boundingBox()).toEqual(firstBox);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('task-create-allocation.png'), animations: 'disabled' });
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: `세 단계 작업 ${width}`, exact: true })).toBeVisible();
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
  await dialog.getByLabel('작업 제목', { exact: true }).fill('짧은 화면 작업');
  await dialog.getByLabel('작업 설명', { exact: true }).fill('계획 단계에서 시간과 도움말을 확인합니다.');
  await next.click();
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

for (const width of [390, 1440]) {
  test(`${width}px 계획 단계에서 날짜와 시간 오류를 막고 뒤로 이동해도 입력을 보존한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    await dialog.getByLabel('작업 제목', { exact: true }).fill('계획 검증 작업');
    await dialog.getByLabel('작업 설명', { exact: true }).fill('단계별 오류와 입력 보존을 확인합니다.');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await dialog.getByLabel('예상 작업량', { exact: true }).selectOption('5');
    const start = dialog.getByLabel('시작일 날짜', { exact: true });
    const due = dialog.getByLabel('마감 날짜', { exact: true });
    await start.fill('');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(start).toBeFocused();
    await start.fill('2030-12-02');
    await due.fill('2030-12-01');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByText('마감은 시작일과 같거나 이후여야 합니다.', { exact: true })).toBeVisible();
    await expect(due).toBeFocused();
    await due.fill('2030-12-03');
    const time = dialog.getByLabel('마감 시간', { exact: true });
    await time.fill('25:10');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(time).toHaveAttribute('aria-invalid', 'true');
    await expect(due).toBeFocused();
    await time.fill('18:30');
    await dialog.getByRole('button', { name: '이전', exact: true }).click();
    await expect(dialog.getByLabel('작업 설명', { exact: true })).toHaveValue('단계별 오류와 입력 보존을 확인합니다.');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByLabel('예상 작업량', { exact: true })).toHaveValue('5');
    await expect(time).toHaveValue('18:30');
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 });
    await expect(dialog.getByRole('list', { name: '작업 입력 단계', exact: true }).locator('[aria-current]')).toHaveText('2작업 계획');
    await expect(due).toHaveValue('2030-12-03');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: '담당자·담당 비율', exact: true })).toBeFocused();
    await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeVisible();
  });
}
