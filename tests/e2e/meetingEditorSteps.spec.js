import { test, expect } from '@playwright/test';
import { goToMeetingStep } from './helpers/meetingEditor.js';
import { formatMeetingRecord, meetingRecordTemplate } from '../../src/lib/meetingRecord.js';

const path = '/preview/spaces/1/teams/1/meeting-minutes';
for (const [width, height] of [[320, 844], [390, 500], [481, 1000], [1440, 1000]]) {
  test(`${width}×${height}: 2단계·템플릿·미리보기·입력 보존과 저장을 확인한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-11-10T15:43:00Z'));
    await page.goto(path);
    await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
    const initialBox = await editor.boundingBox();
    const steps = editor.getByRole('list', { name: '회의록 입력 단계' });
    await expect(steps.locator('li')).toHaveText(['1기본 정보', '2회의 기록']);
    await expect(editor.getByLabel('회의일시 날짜', { exact: true })).toHaveValue('2026-11-11');
    await expect(editor.getByLabel('회의일시 시간', { exact: true })).toHaveValue('00:00');
    await expect(editor.locator('.meeting-attendee-options legend')).toHaveText('참석자 0 / 3명');
    await editor.getByRole('button', { name: '다음', exact: true }).click();
    await expect(editor.getByLabel('제목', { exact: true })).toBeFocused();
    await editor.getByLabel('제목', { exact: true }).fill(`통합 회의 ${width}`);
    await editor.getByRole('checkbox').first().check();
    await goToMeetingStep(editor, 1);
    await expect(editor.getByRole('heading', { name: '회의 기록', exact: true })).toBeFocused();
    expect(await editor.boundingBox()).toEqual(initialBox);
    const field = editor.getByRole('textbox', { name: '회의 기록', exact: true });
    await expect(field).toHaveValue(meetingRecordTemplate);
    const record = formatMeetingRecord({ agenda: '**안건 기록**', content: '**내용 기록**', decisions: '**결정 기록**' });
    await field.fill(record);
    await editor.getByRole('button', { name: '미리보기', exact: true }).click();
    const preview = editor.getByRole('region', { name: '본문 미리보기' });
    for (const label of ['안건', '내용', '결정사항']) await expect(preview.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await goToMeetingStep(editor, 0);
    await expect(editor.getByLabel('제목', { exact: true })).toHaveValue(`통합 회의 ${width}`);
    await expect(editor.locator('.meeting-attendee-options legend')).toHaveText('참석자 1 / 3명');
    await goToMeetingStep(editor, 1);
    await expect(preview).toBeVisible();
    await editor.getByRole('button', { name: '작성', exact: true }).click();
    await expect(field).toHaveValue(record);
    await expect(editor.getByRole('button', { name: '등록', exact: true })).toBeInViewport();
    expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`meeting-record-${width}.png`) });
    await editor.getByRole('button', { name: '등록', exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole('heading', { name: `통합 회의 ${width}`, exact: true })).toBeVisible();
    for (const label of ['안건 기록', '내용 기록', '결정 기록']) await expect(page.getByText(label, { exact: true })).toBeVisible();
  });
}

test('기본 템플릿은 미저장 변경이 아니며 실제 초안은 닫기 확인으로 보호한다', async ({ page }) => {
  await page.goto(path);
  const open = () => page.getByRole('button', { name: '회의록 등록', exact: true }).click();
  await open();
  const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await open();
  await editor.getByLabel('제목', { exact: true }).fill('보존할 초안');
  await goToMeetingStep(editor, 1);
  const record = formatMeetingRecord({ content: '아직 저장하지 않은 회의' });
  await editor.getByRole('textbox', { name: '회의 기록', exact: true }).fill(record);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true }).getByRole('button', { name: '취소', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: '회의 기록', exact: true })).toHaveValue(record);
});

test('통합 편집에서 구분 제목·항목별 길이를 검증하고 템플릿만으로 빈 본문도 저장한다', async ({ page }) => {
  await page.goto(path);
  await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
  await editor.getByLabel('제목', { exact: true }).fill('기록 검증');
  await goToMeetingStep(editor, 1);
  const field = editor.getByRole('textbox', { name: '회의 기록', exact: true });
  await field.fill('삭제하면 안 되는 원문');
  await editor.getByRole('button', { name: '등록', exact: true }).click();
  await expect(field).toHaveValue('삭제하면 안 되는 원문');
  await expect(field).toBeFocused();
  await expect(editor.getByRole('alert')).toContainText('구분 제목');
  await field.fill(formatMeetingRecord({ agenda: '가'.repeat(5001) }));
  await editor.getByRole('button', { name: '등록', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('5,000자');
  await field.fill(meetingRecordTemplate);
  await editor.getByRole('button', { name: '등록', exact: true }).click();
  await expect(editor).toHaveCount(0);
});

test('각 항목의 최대 길이를 한 편집기에 입력해도 잘리지 않고 저장한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
  await editor.getByLabel('제목', { exact: true }).fill('전체 길이 경계');
  await goToMeetingStep(editor, 1);
  const record = formatMeetingRecord({ agenda: '가'.repeat(5000), content: '나'.repeat(20000), decisions: '다'.repeat(5000) });
  const field = editor.getByRole('textbox', { name: '회의 기록', exact: true });
  await field.fill(record);
  expect(await field.inputValue()).toHaveLength(record.length);
  await editor.getByRole('button', { name: '등록', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const lengths = await page.evaluate(async () => {
    const { getMockState } = await import('/src/mock/planned.js');
    const { previewContext } = await import('/src/mock/preview.js');
    const item = getMockState(previewContext()).meetingMinutes.find(item => item.title === '전체 길이 경계');
    return [item.agenda.length, item.content.length, item.decisions.length];
  });
  expect(lengths).toEqual([5000, 20000, 5000]);
});
