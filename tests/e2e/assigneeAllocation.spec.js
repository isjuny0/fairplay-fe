import { goToTaskFormStep } from './helpers/taskForm.js';
import { test, expect } from '@playwright/test';

const names = ['김준영', '김영진', '박선우'];
const roles = ['리더', '팀원', '팀원'];
const person = (dialog, index) =>
  dialog.getByRole('checkbox', {
    name: `${names[index]} · ${roles[index]}`,
    exact: true,
  });
const percent = (dialog, index) =>
  dialog.getByLabel(`${names[index]} 배분율`, { exact: true });

for (const [width, height] of [[320, 844], [390, 500], [1440, 900]]) {
  test(`${width}×${height} 스크롤 중 단계·담당 요약이 담당자 선택과 배분율을 덮지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    await dialog.getByLabel('작업 제목', { exact: true }).fill('스크롤 중 배분 확인');
    await dialog.getByLabel('작업 설명', { exact: true }).fill('단계와 담당 요약이 입력을 가리지 않는지 확인합니다.');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: '담당자·담당 비율', exact: true })).toBeFocused();
    const body = dialog.locator('.modal-body');
    const steps = dialog.getByRole('list', { name: '작업 입력 단계', exact: true });
    const summary = dialog.locator('.allocation-summary');
    await body.evaluate(el => { el.scrollTop = 0; });
    const beforeSteps = await steps.boundingBox();
    const beforeSummary = await summary.boundingBox();
    await body.evaluate(el => { el.scrollTop = 250; });
    const distance = await body.evaluate(el => el.scrollTop);
    expect(distance).toBeGreaterThan(80);
    expect(Math.abs((await steps.boundingBox()).y - beforeSteps.y + distance)).toBeLessThanOrEqual(1);
    expect(Math.abs((await summary.boundingBox()).y - beforeSummary.y + distance)).toBeLessThanOrEqual(1);
    for (const index of [0, 2]) {
      await person(dialog, index).scrollIntoViewIfNeeded();
      await person(dialog, index).check();
      await expect(person(dialog, index)).toBeChecked();
    }
    await percent(dialog, 0).fill('60');
    await percent(dialog, 2).fill('40');
    await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: '이전', exact: true })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeInViewport();
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

async function expectAllocation(dialog, values) {
  for (let index = 0; index < values.length; index++) {
    if (values[index] == null)
      await expect(percent(dialog, index)).toHaveCount(0);
    else
      await expect(percent(dialog, index)).toHaveValue(String(values[index]));
  }
  await expect(
    dialog.getByText(
      `합계 ${values.reduce((sum, value) => sum + (value || 0), 0)}%`,
      { exact: true },
    ),
  ).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`${width}px 담당자를 추가·해제하면 자동 균등 배분하고 저장한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks');
    await page
      .getByRole('button', { name: '새 작업 만들기', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: '새 작업 만들기',
      exact: true,
    });
    await dialog
      .getByLabel('작업 제목', { exact: true })
      .fill('자동 배분 확인');
    await dialog
      .getByLabel('작업 설명', { exact: true })
      .fill('선택한 담당자에게 자동으로 배분합니다.');
    await dialog.getByRole('button', { name: '다음', exact: true }).click();
    await dialog.getByRole('button', { name: '다음', exact: true }).click();

    await person(dialog, 0).check();
    await expectAllocation(dialog, [100, null, null]);
    await person(dialog, 1).check();
    await expectAllocation(dialog, [50, 50, null]);
    await percent(dialog, 0).fill('70');
    await percent(dialog, 1).fill('30');
    await expectAllocation(dialog, [70, 30, null]);
    await person(dialog, 2).check();
    await expectAllocation(dialog, [34, 33, 33]);
    await person(dialog, 1).uncheck();
    await expectAllocation(dialog, [50, null, 50]);
    await person(dialog, 2).uncheck();
    await expectAllocation(dialog, [100, null, null]);
    await person(dialog, 0).uncheck();
    await expectAllocation(dialog, [null, null, null]);
    await expect(
      dialog.getByRole('button', { name: '균등 배분', exact: true }),
    ).toBeDisabled();
    await person(dialog, 1).check();
    await expectAllocation(dialog, [null, 100, null]);
    await person(dialog, 0).check();
    await expectAllocation(dialog, [50, 50, null]);

    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '작업 수정', exact: true });
    await goToTaskFormStep(edit, 2);
    await expectAllocation(edit, [50, 50, null]);
  });

  test(`${width}px 기존 배분과 수동 입력은 유지하고 인원 변경 때만 재배분한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/preview/spaces/1/teams/1/tasks/102');
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '작업 수정', exact: true });
    await dialog
      .getByLabel('작업 제목', { exact: true })
      .fill('기존 비율 유지 확인');
    await goToTaskFormStep(dialog, 2);
    await expectAllocation(dialog, [60, 40, null]);
    await percent(dialog, 0).fill('80');
    await percent(dialog, 1).fill('20');
    await expectAllocation(dialog, [80, 20, null]);
    await goToTaskFormStep(dialog, 1);
    await goToTaskFormStep(dialog, 2);
    await expectAllocation(dialog, [80, 20, null]);
    await person(dialog, 2).check();
    await expectAllocation(dialog, [34, 33, 33]);
    await person(dialog, 2).uncheck();
    await expectAllocation(dialog, [50, 50, null]);
  });
}
