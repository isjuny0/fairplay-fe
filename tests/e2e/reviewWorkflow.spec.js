import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';

async function preview(page, path, role, scenario = 'active') {
  await page.goto('/preview/main');
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  await selectPreviewOption(page, '미리보기 역할', role);
  if (scenario !== 'active')
    await selectPreviewOption(page, '미리보기 상황', scenario);
  await page.goto(`/preview${path}`);
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1 }),
  ).toBeVisible();
}

async function withinViewport(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.bottom <= innerHeight &&
      rect.left >= 0 &&
      rect.right <= innerWidth
    );
  });
}
for (const width of [1440, 1280, 390]) {

}
for (const width of [1440, 1280]) {
  test(`관리자 리포트 ${width}px: 생성된 결과를 먼저 읽고 준비 조건을 펼쳐 확인한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
    await preview(page, '/spaces/1/reports', 'manager', 'review');
    const results = page.getByRole('region', {
      name: '팀 최종 기여율',
      exact: true,
    });
    await expect(results).toBeVisible();
    expect(await withinViewport(results)).toBe(true);
    await expect(
      page.getByRole('list', { name: '회차별 리포트 준비 상태' }),
    ).toBeHidden();
    await page.getByText('평가 제출·생성 조건 확인', { exact: true }).click();
    await expect(
      page.getByRole('list', { name: '회차별 리포트 준비 상태' }),
    ).toContainText('3/3명 제출');
    await expect(
      page.getByRole('button', { name: '생성 완료', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: '리포트 공개', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: '기여도 리포트 공개',
      exact: true,
    });
    await expect(dialog).toContainText('비공개로 되돌릴 수 없습니다.');
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(
      page.getByText('팀원에게 공개되지 않았습니다.', { exact: true }),
    ).toBeVisible();
  });
}
for (const width of [1440, 1280, 390]) {
  test(`평가 저장 ${width}px: 고정 도구에서 대상을 바꾸고 미저장 점수를 보존한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
    await preview(page, '/spaces/1/teams/1/peer-evaluations', 'leader');
    const dock = page.getByRole('region', {
      name: '평가 저장 및 제출',
      exact: true,
    });
    const save = dock.getByRole('button', {
      name: '이지원 평가 저장',
      exact: true,
    });
    await expect(save).toBeEnabled();
    expect(await withinViewport(save)).toBe(true);
    for (const criterion of ['작업 수행', '책임감', '적극성', '의사소통'])
      await page.getByLabel(`이지원 ${criterion} 4점`, { exact: true }).check();
    await dock
      .getByRole('button', { name: '다음 팀원 · 박서연', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: '박서연', exact: true }),
    ).toBeFocused();
    await dock
      .getByRole('button', { name: '다음 팀원 · 이지원', exact: true })
      .click();
    await expect(
      page.getByLabel('이지원 작업 수행 4점', { exact: true }),
    ).toBeChecked();
    await expect(
      dock.getByRole('button', { name: '최종 제출', exact: true }),
    ).toBeDisabled();
    await save.click();
    await expect(dock).toContainText('저장한 평가입니다.');
    await expect(dock).toContainText('1 / 2명 저장');
    await expect(
      dock.getByRole('button', { name: '최종 제출', exact: true }),
    ).toBeDisabled();
    expect(await withinViewport(save)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
