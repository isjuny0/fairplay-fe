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
  test(`공개 리포트 ${width}px: 내 결과와 반영분을 함께 보고 팀 비율은 중복 없이 표시한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await preview(page, '/spaces/1/teams/1/reports', 'leader', 'published');
    const summary = page.getByRole('region', { name: '나의 기여율 요약', exact: true });
    await expect(summary).toContainText('66.0%');
    await expect(summary.locator('dd')).toHaveText([
      '56.0%p반영 비중 70%', '3.3%p반영 비중 10%', '6.7%p반영 비중 20%',
    ], { useInnerText: false });
    if (width >= 1280) expect(await withinViewport(summary)).toBe(true);
    const results = page.getByRole('region', { name: '팀 최종 기여율', exact: true });
    await expect(results.getByRole('columnheader')).toHaveText(['팀원', '최종 기여율']);
    await expect(results.locator('tbody tr')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /계산 근거 보기/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '나의 계산 근거', exact: true })).toBeHidden();
    const help = summary.getByRole('button', { name: '완료 작업 반영분 설명', exact: true });
    await help.focus();
    await expect(summary.getByRole('tooltip')).toContainText('80.0% × 반영 비중 70% = 56.0%p');
    expect(await withinViewport(summary.getByRole('tooltip'))).toBe(true);
    await help.press('Escape');
    await expect(summary.getByRole('tooltip')).toHaveCount(0);
    await summary.getByText('나의 계산 근거 보기', { exact: true }).click();
    await expect(summary.getByRole('heading', { name: '나의 계산 근거', exact: true })).toBeVisible();
    await expect(summary).toContainText('반올림 보정 0.0%p');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
for (const width of [1440, 1280]) {
  test(`관리자 리포트 ${width}px: 생성된 결과와 개인 계산 근거를 검토하고 공개한다`, async ({
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
    await expect(page.locator('.report-review-page > .page-heading p')).toHaveCount(0);
    const toolbar = page.locator('.report-team-toolbar');
    await expect(toolbar.getByRole('button', { name: '팀원에게 공개', exact: true })).toBeVisible();
    await expect(toolbar.locator('.report-publication-status')).toHaveText('미공개');
    await expect(results.getByRole('columnheader')).toHaveText(['팀원', '최종 기여율', '계산 근거']);
    const memberButtons = results.getByRole('button', { name: /계산 근거 보기/ });
    await expect(memberButtons.first()).toHaveText('계산 근거 보기');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: '관리자 동료 평가 상세' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: '회차별 리포트 준비 상태' })).toHaveCount(0);
    await memberButtons.nth(1).focus();
    await memberButtons.nth(1).press('Enter');
    const memberDialog = page.getByRole('dialog', { name: '이지원님의 기여도 상세', exact: true });
    await expect(memberDialog).toContainText('이지원님의 최종 기여율');
    await expect(memberDialog.locator('.report-score-summary')).toHaveCount(1);
    await memberDialog.press('Escape');
    await expect(memberDialog).toHaveCount(0);
    await expect(memberButtons.nth(1)).toBeFocused();
    await page
      .getByRole('button', { name: '팀원에게 공개', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: '기여도 리포트 공개',
      exact: true,
    });
    await expect(dialog).toContainText('비공개로 되돌릴 수 없습니다.');
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await expect(
      page.locator('.report-publication-status'),
    ).toHaveText('미공개');
    await expect(page.getByRole('tablist', { name: '리포트 검토 항목' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: '동료 평가 결과', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: '팀 최종 기여율', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: '리포트 대상 팀' }).selectOption('2');
    await expect(page).toHaveURL(/teamId=2/);
    await expect(page.getByRole('region', { name: '관리자 동료 평가 상세' })).toHaveCount(0);
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
