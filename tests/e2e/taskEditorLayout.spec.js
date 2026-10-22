import { test, expect } from '@playwright/test';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

for (const width of [1440, 768, 390, 320]) {
  test(`${width}px 작업 수정은 필수 별표와 담당 배분을 구분하고 저장한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '작업 수정', exact: true });
    await expect(dialog.locator('.field-label .required-label')).toHaveCount(5);
    for (const star of await dialog
      .locator('.field-label .required-label')
      .all()) {
      await expect(star).toHaveText('*');
      await expect(star).toHaveCSS('color', 'rgb(216, 59, 69)');
    }
    await expect(
      dialog.getByLabel('작업 제목', { exact: true }),
    ).toHaveAttribute('required', '');
    await dialog
      .getByLabel('작업 제목', { exact: true })
      .fill(`작성 화면 개선 ${width}`);
    if (width <= 600)
      await dialog
        .getByRole('button', { name: '다음: 담당·배분', exact: true })
        .click();
    await dialog
      .getByRole('checkbox', { name: '이지원 · 팀원', exact: true })
      .check();
    await dialog
      .getByRole('button', { name: '균등 배분', exact: true })
      .click();
    await expect(
      dialog.getByLabel('김하늘 배분율', { exact: true }),
    ).toHaveValue('50');
    await expect(
      dialog.getByLabel('이지원 배분율', { exact: true }),
    ).toHaveValue('50');
    await expect(dialog.getByText('합계 100%', { exact: true })).toBeVisible();
    const panels = dialog.locator('.task-form-section:not([hidden])');
    expect(
      await panels.evaluateAll((elements) =>
        elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
      ),
    ).toBe(true);
    if (width <= 600)
      await dialog
        .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
        .click();
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('heading', {
        name: `작성 화면 개선 ${width}`,
        exact: true,
      }),
    ).toBeVisible();
  });
}

for (const width of [1440, 390, 320]) {
  test(`${width}px 작업 시간 선택은 팀 홈과 같은 스타일로 적용하고 닫는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const appearance = async (picker) =>
      picker.evaluate((element) => {
        const selected = element.querySelector('[aria-pressed="true"]');
        const apply = element.querySelector('.primary-button');
        const css = getComputedStyle(element),
          optionCss = getComputedStyle(selected),
          applyCss = getComputedStyle(apply);
        return {
          background: css.backgroundColor,
          radius: css.borderRadius,
          selected: optionCss.backgroundColor,
          selectedText: optionCss.color,
          apply: applyCss.backgroundColor,
          applyText: applyCss.color,
          applySize: applyCss.fontSize,
          applyWeight: applyCss.fontWeight,
        };
      });
    await page.goto('/preview/spaces/1/teams/1');
    await openCalendarEventEditor(page);
    const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
    await editor.getByText('시간·메모 추가', { exact: true }).click();
    await editor
      .getByRole('button', { name: '시작 시간 선택 열기', exact: true })
      .click();
    const calendarPicker = editor.getByRole('region', {
      name: '시간 선택',
      exact: true,
    });
    await expect(calendarPicker).toBeVisible();
    const calendarStyle = await appearance(calendarPicker);
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '작업 수정', exact: true });
    const date = dialog.getByRole('textbox', {
      name: '시작일 날짜',
      exact: true,
    });
    const originalDate = await date.inputValue();
    await dialog
      .getByRole('button', { name: '시작일 시간 선택 열기', exact: true })
      .click();
    const picker = dialog.getByRole('region', {
      name: '시간 선택',
      exact: true,
    });
    await expect(picker).toBeVisible();
    expect(await appearance(picker)).toEqual(calendarStyle);
    const panelBox = await picker.boundingBox(),
      inputBox = await dialog
        .getByRole('textbox', { name: '시작일 시간', exact: true })
        .boundingBox();
    expect(Math.abs(panelBox.width - inputBox.width)).toBeLessThanOrEqual(1);
    expect(panelBox.y).toBeGreaterThanOrEqual(0);
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(900);
    await picker.getByRole('button', { name: '09시', exact: true }).click();
    await picker.getByRole('button', { name: '35분', exact: true }).click();
    await picker
      .getByRole('button', { name: '시간 적용', exact: true })
      .click();
    await expect(
      dialog.getByRole('textbox', { name: '시작일 시간', exact: true }),
    ).toHaveValue('09:35');
    await expect(date).toHaveValue(originalDate);
    await dialog
      .getByRole('button', { name: '마감 시간 선택 열기', exact: true })
      .click();
    await expect(picker).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole('button', { name: '마감 시간 선택 열기', exact: true })
      .click();
    await dialog.getByLabel('작업 제목', { exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
}
