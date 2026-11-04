import { test, expect } from '@playwright/test';

const team = '/preview/spaces/1/teams/1';
const scenarios = [
  { name: '스페이스', path: '/preview/main', button: '새 스페이스', dialog: '스페이스 만들기', field: '스페이스 이름' },
  { name: '작업', path: `${team}/tasks`, button: '새 작업 만들기', dialog: '새 작업 만들기', field: '작업 제목' },
  { name: '팀 자료', path: `${team}/deliverables`, button: '팀 자료 등록', dialog: '팀 자료 등록', field: '제목', type: '문서 작성' },
  { name: '공지', path: '/preview/spaces/1/announcements', button: '공지 작성', dialog: '공지 작성', field: '공지 제목', role: 'manager' },
  { name: '회의록', path: `${team}/meeting-minutes`, button: '회의록 등록', dialog: '팀 회의록 등록', field: '제목' },
];

async function assertRedClose(dialog) {
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  await expect(close).toHaveCSS('background-color', 'rgb(229, 36, 52)');
  await expect(close).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(close).toHaveCSS('border-top-color', 'rgb(229, 36, 52)');
  await expect(close).not.toHaveClass(/danger/);
  return close;
}

for (const width of [1440, 390]) {
  for (const scenario of scenarios) {
    test(`${scenario.name} 작성 취소의 닫기 버튼은 선명한 빨강이며 입력 보존과 종료를 유지한다 (${width}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.addInitScript((role) => localStorage.setItem('fairplay:preview-role', role), scenario.role || 'leader');
      await page.goto(scenario.path);
      await page.getByRole('main').getByRole('button', { name: scenario.button, exact: true }).click();
      if (scenario.type) await page.getByRole('dialog', { name: scenario.dialog, exact: true }).getByRole('button', { name: scenario.type, exact: true }).click();
      const editor = page.getByRole('dialog', { name: scenario.type || scenario.dialog, exact: true });
      const iconClose = editor.getByRole('button', { name: '닫기', exact: true });
      await expect(iconClose).not.toHaveCSS('background-color', 'rgb(229, 36, 52)');
      await expect(iconClose).not.toHaveCSS('color', 'rgb(255, 255, 255)');
      const input = editor.getByLabel(scenario.field, { exact: true });
      await input.fill('저장하지 않은 입력 보존 확인');
      await editor.getByRole('button', { name: '닫기', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true });
      await expect(confirmation).toContainText('저장하지 않고 닫을까요?');
      await assertRedClose(confirmation);
      await expect(confirmation.getByRole('button', { name: '확인 창 닫기', exact: true })).toBeVisible();
      await expect(confirmation.getByRole('button', { name: '확인 창 닫기', exact: true })).not.toHaveCSS('background-color', 'rgb(229, 36, 52)');
      await confirmation.getByRole('button', { name: '취소', exact: true }).click();
      await expect(input).toHaveValue('저장하지 않은 입력 보존 확인');
      await expect(confirmation).toHaveCount(0);

      await editor.press('Escape');
      const close = await assertRedClose(confirmation);
      await confirmation.screenshot({ path: testInfo.outputPath('red-close-confirmation.png') });
      await close.hover();
      await expect(close).toHaveCSS('background-color', 'rgb(220, 32, 48)');
      await close.click();
      await expect(editor).toHaveCount(0);
      await expect(confirmation).toHaveCount(0);
    });
  }

  test(`미저장 화면 이동 확인도 같은 닫기 스타일을 사용한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'leader'));
    await page.goto(`${team}/peer-evaluations`);
    const score = page.locator('.peer-target.is-active .score-field').first().getByRole('radio').nth(3);
    await score.check();
    if (width < 721) await page.getByRole('button', {name:'스페이스 메뉴 펼치기',exact:true}).click();
    await page.getByRole('button', { name: '작업', exact: true }).first().click();
    const confirmation = page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true });
    await assertRedClose(confirmation);
    await confirmation.getByRole('button', { name: '계속 작성', exact: true }).click();
    await expect(score).toBeChecked();
    await expect(page).toHaveURL(/peer-evaluations$/);
    if (width < 721) await page.getByRole('button', {name:'스페이스 메뉴 펼치기',exact:true}).click();
    await page.getByRole('button', { name: '작업', exact: true }).first().click();
    await confirmation.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(page).toHaveURL(/\/tasks$/);
  });
}

test('입력하지 않은 작성 창은 추가 확인 없이 닫힌다', async ({ page }) => {
  await page.goto('/preview/main');
  await page.getByRole('main').getByRole('button', { name: '새 스페이스', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
