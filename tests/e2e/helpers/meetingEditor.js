import { expect } from '@playwright/test';

export async function goToMeetingStep(dialog, target) {
  const steps = dialog.getByRole('list', { name: '회의록 입력 단계' });
  await expect(steps).toBeVisible();
  let current = await steps.locator('li').evaluateAll(items => items.findIndex(item => item.getAttribute('aria-current') === 'step'));
  while (current !== target) {
    await dialog.getByRole('button', { name: current < target ? '다음' : '이전', exact: true }).click();
    const next = current + (current < target ? 1 : -1);
    await expect(steps.locator('li').nth(next)).toHaveAttribute('aria-current', 'step');
    current = next;
  }
}

export async function submitMeeting(dialog, label) {
  await goToMeetingStep(dialog, 3);
  await dialog.getByRole('button', { name: label, exact: true }).click();
}
