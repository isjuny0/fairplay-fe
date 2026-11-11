import { expect } from '@playwright/test';

export async function goToTaskFormStep(dialog, target) {
  const current = dialog.getByRole('list', { name: '작업 입력 단계', exact: true }).locator('[aria-current="step"]');
  let step = Number((await current.innerText()).match(/^\d+/)[0]) - 1;
  while (step !== target) {
    const next = step + (step < target ? 1 : -1);
    await dialog.getByRole('button', { name: step < target ? '다음' : '이전', exact: true }).click();
    await expect(current).toHaveText(`${next + 1}${['작업 내용', '작업 계획', '담당자 배분'][next]}`);
    step = next;
  }
}
