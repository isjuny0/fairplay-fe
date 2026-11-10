import { test, expect } from '@playwright/test';
import { selectPreviewOption } from './helpers/previewControls.js';
import { openCalendarEventEditor } from './helpers/teamDashboard.js';

const team = '/preview/spaces/1/teams/1';

test.use({ timezoneId: 'America/New_York' });

for (const width of [390, 1440]) {
  test(`${width}px: 작업 초기 시간은 자정이고 시간 직접 선택과 날짜 변경은 입력 시간을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-10T15:43:00Z'));
    await page.goto(`${team}/tasks`);
    await page.getByRole('button', { name: '새 작업 만들기', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '새 작업 만들기', exact: true });
    {
      await dialog.getByLabel('작업 제목', { exact: true }).fill('자정 기본값 확인');
      await dialog.getByLabel('작업 설명', { exact: true }).fill('계획 단계에서 기본 시간과 직접 선택을 확인합니다.');
      await dialog.getByRole('button', { name: '다음', exact: true }).click();
    }
    for (const label of ['시작일', '마감']) {
      await expect(dialog.getByLabel(`${label} 날짜`, { exact: true })).toHaveValue('2026-11-11');
      await expect(dialog.getByLabel(`${label} 시간`, { exact: true })).toHaveValue('00:00');
    }
    await dialog.getByRole('button', { name: '시작일 시간 선택 열기', exact: true }).click();
    const picker = page.getByRole('region', { name: '시간 선택', exact: true });
    await expect(picker.getByLabel('선택한 시간')).toHaveText('00:00');
    await picker.getByRole('button', { name: '09시', exact: true }).click();
    await picker.getByRole('button', { name: '35분', exact: true }).click();
    await expect(picker.getByLabel('선택한 시간')).toHaveText('09:35');
    await picker.getByRole('button', { name: '시간 적용', exact: true }).click();
    await dialog.getByLabel('시작일 날짜', { exact: true }).fill('2026-11-15');
    await expect(dialog.getByLabel('시작일 시간', { exact: true })).toHaveValue('09:35');
  });

  test(`${width}px: 회의 기본 일시와 날짜 직접 입력·달력 선택은 00:00을 사용한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-10T11:43:00Z'));
    await page.goto(`${team}/meeting-minutes`);
    await page.getByRole('button', { name: '회의록 등록', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '팀 회의록 등록', exact: true });
    await expect(editor.getByLabel('회의일시 날짜', { exact: true })).toHaveValue('2026-11-10');
    await expect(editor.getByLabel('회의일시 시간', { exact: true })).toHaveValue('00:00');
    await editor.getByLabel('회의일시 날짜', { exact: true }).fill('2026-11-12');
    await expect(editor.getByLabel('회의일시 시간', { exact: true })).toHaveValue('00:00');
    await editor.getByLabel('회의일시 시간', { exact: true }).fill('');
    await editor.getByRole('button', { name: '회의일시 달력 열기', exact: true }).click();
    await editor.getByRole('button', { name: '2026년 11월 13일', exact: true }).click();
    await expect(editor.getByLabel('회의일시 시간', { exact: true })).toHaveValue('00:00');
  });

  test(`${width}px: 회의록 수정은 저장된 시간을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${team}/meeting-minutes/1`);
    await page.getByRole('button', { name: '회의록 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '팀 회의록 수정', exact: true });
    const original = await edit.getByLabel('회의일시 시간', { exact: true }).inputValue();
    expect(original).not.toBe('00:00');
    await edit.getByLabel('회의일시 날짜', { exact: true }).fill('2026-11-16');
    await expect(edit.getByLabel('회의일시 시간', { exact: true })).toHaveValue(original);
  });
}

test('미입력 팀 일정의 선택기는 00:00으로 열리고 종일 상태는 자동 변경하지 않는다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-10T11:43:00Z'));
  await page.goto(team);
  await openCalendarEventEditor(page);
  const editor = page.getByRole('dialog', { name: '일정 추가', exact: true });
  await editor.locator('.team-calendar-event-extras summary').click();
  for (const label of ['시작', '종료']) {
    await expect(editor.getByLabel(`${label} 시간`, { exact: true })).toHaveValue('');
    await editor.getByRole('button', { name: `${label} 시간 선택 열기`, exact: true }).click();
    const picker = page.getByRole('region', { name: '시간 선택', exact: true });
    await expect(picker.getByLabel('선택한 시간')).toHaveText('00:00');
    await page.keyboard.press('Escape');
    await expect(editor.getByLabel(`${label} 시간`, { exact: true })).toHaveValue('');
  }
});

test('평가 일정 초기 시간은 허용된 날짜의 자정이며 저장할 수 있다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-10T11:43:00Z'));
  await page.goto('/preview/main');
  await selectPreviewOption(page, '미리보기 역할', 'manager');
  await selectPreviewOption(page, '미리보기 상황', 'setup');
  await page.goto('/preview/spaces/1/rounds');
  await page.getByRole('button', { name: '중간 평가 일정 설정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '중간 평가 일정 설정', exact: true });
  await expect(editor.getByLabel('평가 시작 시각 날짜', { exact: true })).toHaveValue('2026-11-11');
  await expect(editor.getByLabel('평가 시작 시각 시간', { exact: true })).toHaveValue('00:00');
  await expect(editor.getByLabel('평가 마감 시각 시간', { exact: true })).toHaveValue('00:00');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('region', { name: '중간 평가 운영', exact: true })).toContainText('시작 예정');
});
