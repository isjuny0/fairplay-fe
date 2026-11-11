import { goToTaskFormStep } from './helpers/taskForm.js';
import { test, expect } from '@playwright/test';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

for (const width of [1440, 900, 720, 390, 320]) {
  test(`${width}px 작업 등록·수정은 같은 크기와 3단계 구성으로 입력한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const create = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    const createBox = await create.boundingBox();
    const descriptionHeight = (await create.getByLabel('작업 설명', { exact: true }).boundingBox()).height;
    await create.getByRole('button', { name: '닫기', exact: true }).click();
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '작업 수정', exact: true });
    expect(await edit.boundingBox()).toEqual(createBox);
    expect((await edit.getByLabel('작업 설명', { exact: true }).boundingBox()).height).toEqual(descriptionHeight);
    await expect(edit.getByRole('list', { name: '작업 입력 단계', exact: true }).locator('li')).toHaveText(['1작업 내용', '2작업 계획', '3담당자 배분']);
    await expect(edit.getByLabel('작업 제목', { exact: true })).toHaveValue('AI 피드백 화면 개선');
    await expect(edit.getByLabel('예상 시간', { exact: true })).toBeHidden();
    await expect(edit.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
    await goToTaskFormStep(edit, 1);
    expect(await edit.boundingBox()).toEqual(createBox);
    await expect(edit.getByRole('heading', { name: '작업 계획', exact: true })).toBeFocused();
    await expect(edit.getByLabel('작업 제목', { exact: true })).toBeHidden();
    const dueAt = await edit.getByLabel('마감 날짜', { exact: true }).inputValue();
    await goToTaskFormStep(edit, 2);
    expect(await edit.boundingBox()).toEqual(createBox);
    await expect(edit.getByRole('region', { name: '저장 전 확인', exact: true })).toBeVisible();
    await expect(edit.getByRole('button', { name: '작업량 기준 자동 선택', exact: true })).toHaveCount(0);
    await goToTaskFormStep(edit, 1);
    await expect(edit.getByLabel('마감 날짜', { exact: true })).toHaveValue(dueAt);
    expect(await edit.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

for (const width of [1440, 768, 390, 320]) {
  test(`${width}px 작업 수정은 필수 별표와 담당 배분을 구분하고 저장한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks/103');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '작업 수정', exact: true });
    await expect(dialog.locator('.form-field .required-label')).toHaveCount(5);
    for (const star of await dialog
      .locator('.form-field .required-label')
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
    await goToTaskFormStep(dialog, 2);
    await dialog
      .getByRole('checkbox', { name: '김영진 · 팀원', exact: true })
      .check();
    await expect(
      dialog.getByLabel('김준영 배분율', { exact: true }),
    ).toHaveValue('50');
    await expect(
      dialog.getByLabel('김영진 배분율', { exact: true }),
    ).toHaveValue('50');
    await expect(dialog.getByText('합계 100%', { exact: true })).toBeVisible();
    const panels = dialog.locator('.task-form-section:not([hidden])');
    expect(
      await panels.evaluateAll((elements) =>
        elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
      ),
    ).toBe(true);

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
    await goToTaskFormStep(dialog, 1);
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
    await dialog.getByLabel('예상 시간', { exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });
}
