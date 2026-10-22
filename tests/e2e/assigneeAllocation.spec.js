import { test, expect } from '@playwright/test';

const names = ['김하늘', '이지원', '박서연'];
const roles = ['리더', '팀원', '팀원'];
const person = (dialog, index) =>
  dialog.getByRole('checkbox', {
    name: `${names[index]} · ${roles[index]}`,
    exact: true,
  });
const percent = (dialog, index) =>
  dialog.getByLabel(`${names[index]} 배분율`, { exact: true });

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
    if (width <= 600)
      await dialog
        .getByRole('button', { name: '다음: 담당·배분', exact: true })
        .click();

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

    if (width <= 600)
      await dialog
        .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
        .click();
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: '작업 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '작업 수정', exact: true });
    if (width <= 600)
      await edit
        .getByRole('button', { name: '다음: 담당·배분', exact: true })
        .click();
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
    if (width <= 600)
      await dialog
        .getByRole('button', { name: '다음: 담당·배분', exact: true })
        .click();
    await expectAllocation(dialog, [60, 40, null]);
    await percent(dialog, 0).fill('80');
    await percent(dialog, 1).fill('20');
    await expectAllocation(dialog, [80, 20, null]);
    if (width <= 600) {
      await dialog
        .getByRole('button', { name: '다음: 저장 전 확인', exact: true })
        .click();
      await dialog.getByRole('button', { name: '이전', exact: true }).click();
      await expectAllocation(dialog, [80, 20, null]);
    }
    await person(dialog, 2).check();
    await expectAllocation(dialog, [34, 33, 33]);
    await person(dialog, 2).uncheck();
    await expectAllocation(dialog, [50, 50, null]);
  });
}
