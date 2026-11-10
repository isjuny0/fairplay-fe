import { test, expect } from '@playwright/test';
import { goToMeetingStep } from './helpers/meetingEditor.js';

const path = '/preview/spaces/1/teams/1/meeting-minutes';
for (const [width, height] of [[320, 844], [390, 500], [481, 1000], [1440, 1000]]) {
  test(`${width}×${height}: 단계별 등록·입력 보존·참석 인원·기본 일시와 저장을 확인한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-11-10T15:43:00Z'));
    await page.goto(path);
    await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
    const initialBox = await editor.boundingBox();
    const steps = editor.getByRole('list', { name: '회의록 입력 단계' });
    await expect(steps.locator('li')).toHaveText(['1기본 정보', '2안건', '3논의 내용', '4결정사항']);
    await expect(editor.getByRole('group', { name: '회의 기록 항목' })).toHaveCount(0);
    await expect(editor.getByText('한국 시간 기준입니다. 과거·미래 회의 모두 기록할 수 있습니다.')).toHaveCount(0);
    await expect(editor.getByText(/승인된 팀원 모두 함께 수정할 수 있습니다/)).toHaveCount(0);
    await expect(editor.getByLabel('회의일시 날짜', { exact: true })).toHaveValue('2026-11-11');
    await expect(editor.getByLabel('회의일시 시간', { exact: true })).toHaveValue('00:00');
    const date = await editor.getByLabel('회의일시 날짜', { exact: true }).boundingBox();
    const time = await editor.getByLabel('회의일시 시간', { exact: true }).boundingBox();
    expect(Math.abs(date.y - time.y)).toBeLessThan(1);
    const caption = editor.locator('.date-time-input > .date-time-caption').first();
    expect((await caption.boundingBox()).y).toBeLessThan(date.y);
    await expect(editor.locator('.meeting-attendee-options legend')).toHaveText('참석자 0 / 3명');
    await expect(editor.getByRole('button', { name: '등록', exact: true })).toHaveCount(0);
    await editor.getByRole('button', { name: '다음', exact: true }).click();
    await expect(editor.getByLabel('제목', { exact: true })).toBeFocused();
    await expect(steps.locator('li').first()).toHaveAttribute('aria-current', 'step');
    await editor.getByLabel('제목', { exact: true }).fill(`네 단계 회의 ${width}`);
    await editor.getByRole('checkbox').first().check();
    await expect(editor.locator('.meeting-attendee-options legend')).toHaveText('참석자 1 / 3명');
    for (const [step, label] of [[1, '안건'], [2, '논의 내용'], [3, '결정사항']]) {
      await editor.getByRole('button', { name: '다음', exact: true }).click();
      await expect(editor.getByRole('heading', { name: label, exact: true })).toBeFocused();
      expect(await editor.boundingBox()).toEqual(initialBox);
      const field = editor.getByRole('textbox', { name: label, exact: true });
      await field.fill(`**${label} 기록**`);
      const submit = editor.locator('.modal-actions button[type=submit]');
      await expect(submit).toBeInViewport();
      const submitBox = await submit.boundingBox();
      expect(submitBox.y + submitBox.height).toBeLessThanOrEqual(height);
      expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await goToMeetingStep(editor, 0);
    await expect(editor.getByLabel('제목', { exact: true })).toHaveValue(`네 단계 회의 ${width}`);
    await expect(editor.locator('.meeting-attendee-options legend')).toHaveText('참석자 1 / 3명');
    await goToMeetingStep(editor, 1);
    await expect(editor.getByRole('textbox', { name: '안건', exact: true })).toHaveValue('**안건 기록**');
    await editor.getByRole('button', { name: '미리보기', exact: true }).click();
    await expect(editor.getByRole('region', { name: '본문 미리보기' })).toContainText('안건 기록');
    await goToMeetingStep(editor, 3);
    await expect(editor.getByRole('textbox', { name: '결정사항', exact: true })).toHaveValue('**결정사항 기록**');
    await page.screenshot({ path: testInfo.outputPath(`meeting-wizard-${width}.png`) });
    await editor.getByRole('button', { name: '등록', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole('heading', { name: `네 단계 회의 ${width}`, exact: true })).toBeVisible();
    for (const text of ['안건 기록', '논의 내용 기록', '결정사항 기록']) await expect(page.getByText(text, { exact: true })).toBeVisible();
  });
}

test('새 회의록의 기본 일시는 미저장 변경으로 취급하지 않으며 작성한 내용은 닫기 확인을 거친다', async ({ page }) => {
  await page.goto(path);
  const open = () => page.getByRole('button', { name: '회의록 등록', exact: true }).click();
  await open();
  const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await open();
  await editor.getByLabel('제목', { exact: true }).fill('보존할 초안');
  await goToMeetingStep(editor, 2);
  await editor.getByRole('textbox', { name: '논의 내용', exact: true }).fill('아직 저장하지 않은 회의');
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true });
  await confirm.getByRole('button', { name: '취소', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: '논의 내용', exact: true })).toHaveValue('아직 저장하지 않은 회의');
});
