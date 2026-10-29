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
  test(`공개 리포트 ${width}px: 본인의 종합점수와 평가 결과만 표시한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await preview(page, '/spaces/1/teams/1/reports', 'leader', 'published');
    const summary = page.getByRole('region', { name: '나의 종합 평가 요약', exact: true });
    await expect(summary).toBeVisible();
    await expect(summary.locator('.report-composition-track')).toHaveCount(1);
    await expect(summary.locator('.report-component-meter')).toHaveCount(0);
    await expect(summary.locator('.report-component-value')).toContainText(['70.0점', '7.0점', '14.0점']);
    await expect(summary.locator('.composite-work-ratio > span').first()).toHaveText('내 완료 작업량 비율 80.0%');
    const ratioHelp = summary.getByRole('button', { name: '완료 작업량 비율 설명', exact: true });
    await ratioHelp.focus();
    await expect(summary.getByRole('tooltip')).toContainText('내 완료 작업량 ÷ 팀 전체 완료 작업량 × 100');
    await expect(summary.getByRole('tooltip')).toContainText('고정 평가 인원 3명');
    expect(await withinViewport(summary.getByRole('tooltip'))).toBe(true);
    await ratioHelp.press('Escape');
    await expect(page.getByRole('region', { name: '팀원별 종합 평가', exact: true })).toHaveCount(0);
    await expect(page.locator('.report-team-result')).toHaveCount(0);
    const evidence = page.getByRole('region', { name: '나의 수행 근거', exact: true });
    await expect(evidence.getByRole('region', { name: '나의 종합 평가 요약', exact: true })).toBeVisible();
    await expect(evidence.getByRole('heading', { name: '반영된 완료 작업', exact: true })).toBeVisible();
    await expect(evidence.locator('.evidence-task')).toHaveCount(2);
    await expect(evidence.locator('.report-member-evidence-heading')).toHaveCount(0);
    await expect(evidence.locator('.evidence-task-summary')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '내 완료 작업 보기', exact: true })).toHaveCount(0);
    await expect(page.getByText('이지원', { exact: true })).toHaveCount(0);
    await expect(page.getByText('박서연', { exact: true })).toHaveCount(0);
    const help = summary.getByRole('button', { name: '작업 점수 반영점수 설명', exact: true });
    await help.focus();
    await expect(summary.getByRole('tooltip')).toContainText('팀 평균 완료 작업량을 충족하면 작업 점수는 100점입니다.');
    await help.press('Escape');
    const criteria = summary.getByRole('region', { name: '동료 평가 항목별 결과', exact: true });
    await expect(criteria.locator('dt')).toHaveText(['작업 수행', '책임감', '적극성', '의사소통']);
    await criteria.getByRole('button', { name: '최종 평가', exact: true }).click();
    await expect(criteria.getByRole('button', { name: '최종 평가', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(summary.getByText('종합점수 계산 보기', { exact: true })).toHaveCount(0);
    await expect(summary.getByRole('table')).toHaveCount(0);
    await expect(summary).not.toContainText('%p');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
for (const width of [1440, 1280, 390]) {
  test(`관리자 리포트 ${width}px: 한 패널에서 팀원을 전환하고 수행 근거를 검토한 뒤 공개한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 1000 });
    await preview(page, '/spaces/1/reports', 'manager', 'review');
    await page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true }).click();
    const results = page.getByRole('region', { name: '팀원별 종합 평가', exact: true });
    await expect(results).toBeVisible();
    await expect(results).toBeVisible();
    await expect(page.locator('.report-review-page > .page-heading p')).toHaveCount(0);
    const toolbar = page.locator('.report-detail-drawer');
    await expect(toolbar.getByRole('button', { name: '팀원에게 공개', exact: true })).toHaveCount(0);
    await expect(toolbar.locator('.report-publication-status')).toHaveText('미공개');
    await expect(results.getByRole('columnheader')).toHaveText(['팀원', '완료 작업량 비율', '작업 점수', '중간 평가', '최종 평가', '종합점수']);
    const memberButtons = results.getByRole('button', { name: /수행 근거 확인/ });
    await expect(memberButtons.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('region', { name: '관리자 동료 평가 상세' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: '팀별 리포트 준비 상태' })).toHaveCount(0);
    await memberButtons.nth(1).focus();
    await memberButtons.nth(1).press('Enter');
    const evidence = page.getByRole('region', { name: '이지원님의 수행 근거', exact: true });
    await expect(evidence.locator('.report-visual-breakdown')).toBeVisible();
    await expect(evidence.locator('.report-total-ring')).toHaveCount(0);
    await expect(evidence.locator('.report-composition-track')).toHaveCount(1);
    await expect(evidence.locator('.report-component-weight')).toHaveText(['평가 비중70%', '평가 비중10%', '평가 비중20%']);
    await expect(evidence.getByRole('heading', { name: '반영된 완료 작업', exact: true })).toBeVisible();
    await expect(evidence.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(evidence.getByText('종합점수 계산 보기', { exact: true })).toHaveCount(0);
    await evidence.getByRole('combobox', { name: '상세 조회 팀원', exact: true }).focus();
    await evidence.getByRole('combobox', { name: '상세 조회 팀원', exact: true }).selectOption({ label: '김하늘' });
    await expect(page.getByRole('combobox', { name: '상세 조회 팀원', exact: true })).toBeFocused();
    await expect(page.getByRole('region', { name: '김하늘님의 수행 근거', exact: true })).toBeVisible();
    await expect(evidence).toHaveCount(0);
    const firstEvidence = page.getByRole('region', { name: '김하늘님의 수행 근거', exact: true });
    await firstEvidence.locator('.evidence-task-toggle').first().click();
    await expect(firstEvidence.getByRole('heading', { name: '본인 수행 설명', exact: true })).toBeVisible();
    await expect(firstEvidence.getByRole('heading', { name: '현재 연결 자료', exact: true })).toBeVisible();
    await firstEvidence.getByRole('combobox', { name: '상세 조회 팀원', exact: true }).selectOption({ label: '박서연' });
    const emptyEvidence = page.getByRole('region', { name: '박서연님의 수행 근거', exact: true });
    await expect(emptyEvidence.getByRole('heading', { name: '반영된 완료 작업이 없습니다.', exact: true })).toBeVisible();
    await expect(emptyEvidence.locator('.report-personal-summary')).toBeVisible();
    expect(await toolbar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await toolbar.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
    await page.getByRole('button', { name: '전체 리포트 공개', exact: true }).click();
    const dialog = page.getByRole('dialog', {
      name: '전체 리포트 공개',
      exact: true,
    });
    await expect(dialog).toContainText('비공개로 되돌릴 수 없습니다.');
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true }).click();
    await expect(page.locator('.report-publication-status')).toHaveText('미공개');
    await expect(page.getByRole('tablist', { name: '리포트 검토 항목' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: '동료 평가 결과', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: '팀원별 종합 평가', exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: '삼위일체 리포트', exact: true }).press('Escape');
    await page.getByRole('button', { name: '파도 리포트 확인', exact: true }).click();
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
    const fields = page.locator('.peer-target.is-active .score-field');
    const firstField = await fields.nth(0).boundingBox();
    const secondField = await fields.nth(1).boundingBox();
    if (width >= 1200) {
      expect(Math.abs(firstField.y - secondField.y)).toBeLessThan(1);
      expect(secondField.x).toBeGreaterThan(firstField.x);
    } else expect(secondField.y).toBeGreaterThan(firstField.y);
    await expect(page.locator('.peer-response-sidebar')).toBeVisible();

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
    await expect(page.locator('.evaluation-progress')).toContainText('1 / 2명 저장');
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

for (const width of [1440, 1079, 768, 320]) {
  test(`제출 응답 ${width}px: 이전 평가 양식에서 점수·사유를 읽고 팀원을 전환한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await preview(page, '/spaces/1/teams/1/peer-evaluations?roundId=11', 'member', 'published');
    await expect(page.getByRole('heading', { name: '마감된 평가 · 내가 저장한 응답', exact: true })).toBeVisible();
    await expect(page.getByLabel('김하늘 작업 수행 4점', { exact: true })).toBeChecked();
    await expect(page.getByLabel('김하늘 적극성 2점', { exact: true })).toBeChecked();
    await expect(page.getByLabel('김하늘 작업 수행 4점', { exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: '평가 사유', exact: true }).first()).toBeDisabled();
    await expect(page.getByRole('region', { name: '평가 저장 및 제출', exact: true })).toHaveCount(0);
    const choices = page.getByRole('group', { name: '평가할 팀원 선택', exact: true });
    if (width > 720) {
      const first = await choices.getByRole('button').first().boundingBox();
      const second = await choices.getByRole('button').nth(1).boundingBox();
      expect(second.y).toBeGreaterThan(first.y);
    }
    await choices.getByRole('button', { name: /^박서연/ }).click();
    await expect(page.getByRole('heading', { name: '박서연', exact: true })).toBeFocused();
    await expect(page.getByLabel('박서연 작업 수행 4점', { exact: true })).toBeDisabled();
    const schedule = page.getByRole('region', { name: '선택한 평가 일정', exact: true });
    await expect(schedule.locator('time')).toHaveCount(2);
    if (width >= 1079) {
      const tabs = await page.getByRole('group', { name: '평가 회차 선택', exact: true }).boundingBox();
      const dates = await schedule.boundingBox();
      expect(dates.x).toBeGreaterThanOrEqual(tabs.x + tabs.width);
      expect(Math.abs(dates.y + dates.height / 2 - tabs.y - tabs.height / 2)).toBeLessThan(1);
    }

    await expect(schedule).not.toContainText('중간 평가');
    await expect(page.getByText('마감 후 스페이스 관리자가 최종 제출된 점수와 사유를 열람할 수 있습니다.', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [390, 320]) {
  test(`리포트 관리 ${width}px: 생성 전에는 설정에 집중하고 생성 후 팀 결과를 공개한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await preview(page, '/spaces/1/reports', 'manager', 'evaluated');
    const results = page.getByRole('region', { name: '팀별 리포트 결과', exact: true });
    await expect(results).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '리포트 대상 팀', exact: true })).toHaveCount(0);
    await expect(page.getByRole('list', { name: '팀별 리포트 준비 상태', exact: true }).getByRole('listitem')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
    await expect(results).toBeVisible();
    await expect(page.getByRole('list', { name: '팀별 리포트 준비 상태', exact: true })).toHaveCount(0);
    await expect(results.getByRole('row').filter({ hasText: '삼위일체' })).toContainText('미공개');
    await page.locator('.report-weights-disclosure > summary').click();
    await expect(page.getByRole('region', { name: '확정된 평가 비중', exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
    await expect(page.getByLabel('가상 점수 계산 예시')).toHaveCount(0);
    await page.locator('.report-weights-disclosure > summary').click();
    await page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true }).click();
    await page.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
    await page.getByRole('button', { name: '전체 리포트 공개', exact: true }).click();
    await page.getByRole('dialog', { name: '전체 리포트 공개', exact: true }).getByRole('button', { name: '전체 공개 확정', exact: true }).click();
    await expect(page.getByRole('heading', { name: '전체 리포트 공개 완료', exact: true })).toBeVisible();
    await expect(results.getByRole('row').filter({ hasText: '삼위일체' })).toContainText('공개 완료');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('상태 필터 없이 전체 팀을 표시하고 공개 후 목록 갱신과 패널 초점을 유지한다', async ({ page }) => {
  await preview(page, '/spaces/1/reports', 'manager', 'review');
  const filters = page.getByRole('group', { name: '리포트 상태 필터', exact: true });
  await expect(filters).toHaveCount(0);
  await expect(page.locator('.report-team-count')).toHaveText('전체 2팀');
  const list = page.getByRole('region', { name: '팀별 리포트 목록', exact: true });
  await expect(list.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '리포트 관리 새로고침', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true }).click();
  const report = page.getByRole('dialog', { name: '삼위일체 리포트', exact: true });
  await expect(report).toBeVisible();
  await report.getByRole('button', { name: '목록으로 돌아가기', exact: true }).click();
  await expect(page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '전체 리포트 공개', exact: true }).click();
  await page.getByRole('dialog', { name: '전체 리포트 공개', exact: true }).getByRole('button', { name: '전체 공개 확정', exact: true }).click();
  await expect(report).toHaveCount(0);
  await expect(list.locator('tbody tr')).toHaveCount(2);
  await expect(list.locator('tbody tr')).toContainText(['공개 완료', '공개 완료']);
  await expect(list).toContainText('삼위일체');
  await expect(list).toContainText('파도');
  await expect(filters).toHaveCount(0);
});

for (const width of [1079, 390]) {
  test(`리포트 관리자 가이드 ${width}px: 점수와 실제 원문을 검토하고 전체 공개한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await preview(page, '/spaces/1/reports', 'manager', 'evaluated');
    await page.getByRole('button', { name: '사용자 가이드', exact: true }).click();
    await page.getByRole('tab', { name: '관리자 가이드', exact: true }).click();
    await page.getByRole('button', { name: '리포트 생성·공개하기 시작', exact: true }).click();
    const callout = page.locator('[data-preview-guide-callout]');
    await expect(callout).toContainText('첫 생성 성공 후');
    const initialConfirm = page.getByRole('button', { name: '생성 조건 확인 완료', exact: true });
    await page.getByRole('spinbutton', { name: '작업 점수 평가 비중', exact: true }).fill('60');
    await expect(initialConfirm).toBeDisabled();
    await page.getByRole('spinbutton', { name: '중간 동료 평가 평가 비중', exact: true }).fill('20');
    await expect(initialConfirm).toBeEnabled();
    await initialConfirm.click();
    await expect(page.locator('.report-weights-disclosure')).not.toHaveAttribute('open');
    await expect(callout).toContainText('아직 팀원에게 공개되지 않습니다.');
    await page.getByRole('button', { name: '전체 리포트 생성', exact: true }).click();
    await expect(callout).toContainText('삼위일체');
    await page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true }).click();
    const report = page.getByRole('dialog', { name: '삼위일체 리포트', exact: true });
    await expect(report).toBeVisible();
    await expect(report.locator('[data-preview-guide-callout]')).toContainText('원점수 → 평가 비중 → 반영 점수');
    const evidence = report.getByRole('region', { name: '김하늘님의 수행 근거', exact: true });
    await evidence.getByRole('button', { name: '점수 검토 완료', exact: true }).click();
    await expect(report).toBeVisible();
    const finishReview = report.getByRole('button', { name: '작업 근거 검토 완료', exact: true });
    await expect(finishReview).toBeDisabled();
    await evidence.locator('[data-guide-report-task="101"]').click();
    await expect(callout).toContainText('연결된 ‘인터뷰 계획과 질문 목록’을 직접 누르세요.');
    const material = evidence.locator('[data-guide-report-material="1002"]');
    await material.click();
    await expect(finishReview).toBeEnabled();
    await expect(callout).toContainText('연결된 문서를 열었습니다.');
    await material.click();
    await expect(finishReview).toBeDisabled();
    await material.click();
    await expect(finishReview).toBeEnabled();
    await evidence.getByRole('combobox', { name: '상세 조회 팀원', exact: true }).selectOption({ label: '이지원' });
    await expect(finishReview).toBeDisabled();
    await expect(callout).toContainText('김하늘님의 결과를 선택');
    await report.getByRole('button', { name: '가이드 안내 위치', exact: true }).click();
    await expect(evidence).toBeVisible();
    await expect(evidence.locator('[data-guide-report-task="101"]')).toHaveAttribute('aria-expanded', 'true');
    await evidence.locator('[data-guide-report-material="1002"]').click();
    await expect(finishReview).toBeEnabled();
    await finishReview.click();
    await expect(report).toHaveCount(0);
    const publish = page.getByRole('button', { name: '전체 리포트 공개', exact: true });
    await expect(publish).toHaveClass(/preview-guide-action-highlight/);
    await publish.click();
    const confirmation = page.getByRole('dialog', { name: '전체 리포트 공개', exact: true });
    await expect(confirmation.locator('[data-preview-guide-callout]')).toContainText('본인의 종합점수·평가 결과·작업 근거만');
    await confirmation.getByRole('button', { name: '취소', exact: true }).click();
    await expect(publish).toBeEnabled();
    await publish.click();
    await confirmation.getByRole('button', { name: '전체 공개 확정', exact: true }).click();
    await expect(callout).toContainText('모두 ‘공개 완료’');
    await expect(page.locator('.report-management-table .report-list-status')).toHaveText(['공개 완료', '공개 완료']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '공개 결과 확인 완료', exact: true }).click();
    await expect(page.getByRole('heading', { name: '리포트 생성·공개하기 완료', exact: true })).toBeVisible();
  });
}


for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`리포트 패널 전환은 배경 전체를 다시 페이드하지 않는다 (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await preview(page, '/spaces/1/reports', 'manager', 'review');
    await expect(page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true })).toBeVisible();
    await page.evaluate(() => {
      window.reportMainAnimations = 0;
      const originalAnimate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        if (this.tagName === 'MAIN') window.reportMainAnimations++;
        return originalAnimate.apply(this, args);
      };
    });
    const main = page.getByRole('main');
    const before = await main.boundingBox();
    await page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '삼위일체 리포트', exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('region', { name: '김하늘님의 수행 근거', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.reportMainAnimations)).toBe(0);
    expect(await main.boundingBox()).toEqual(before);
    expect(await drawer.evaluate((element) => getComputedStyle(element).animationName))
      .toBe(reducedMotion === 'reduce' ? 'none' : 'report-drawer-enter');
    await drawer.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: '삼위일체 리포트 확인', exact: true })).toBeFocused();
    expect(await page.evaluate(() => window.reportMainAnimations)).toBe(0);
  });
}

for (const width of [1079, 390]) {
  test(`기여도 리포트 가이드 ${width}px: 평가 전환과 연결 문서 조회를 직접 완료한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await preview(page, '/spaces/1/teams/1/reports', 'leader', 'published');
    await page.getByRole('button', { name: '사용자 가이드', exact: true }).click();
    await page.getByRole('button', { name: '내 기여도 확인하기 시작', exact: true }).click();
    const callout = page.locator('[data-preview-guide-callout]');
    await expect(callout).toContainText('개인별 100점 만점');
    await expect(page.locator('.report-score-total.preview-guide-highlight')).toHaveCount(1);
    await page.getByRole('button', { name: '종합점수 확인 완료', exact: true }).click();
    await expect(callout).toContainText('원점수 → 평가 비중 → 반영 점수');
    await expect(page.locator('.report-score-components > dl.preview-guide-highlight')).toHaveCount(1);
    await page.getByRole('button', { name: '반영 점수 확인 완료', exact: true }).click();
    await expect(callout).toContainText('‘최종 평가’를 직접 눌러');
    if (width === 1079) {
      await page.getByRole('button', { name: '스페이스 홈', exact: true }).click();
      await page.getByRole('button', { name: '가이드로 돌아가기', exact: true }).click();
      await expect(callout).toContainText('‘최종 평가’를 직접 눌러');
    }
    const criteria = page.getByRole('region', { name: '동료 평가 항목별 결과', exact: true });
    const peerConfirm = criteria.getByRole('button', { name: '동료 평가 확인 완료', exact: true });
    await expect(peerConfirm).toBeDisabled();
    await criteria.getByRole('button', { name: '최종 평가', exact: true }).click();
    await expect(callout).toContainText('최종 평가 결과를 열었습니다.');
    await expect(peerConfirm).toBeEnabled();
    await criteria.getByRole('button', { name: '중간 평가', exact: true }).click();
    await expect(peerConfirm).toBeDisabled();
    await criteria.getByRole('button', { name: '최종 평가', exact: true }).click();
    await peerConfirm.click();
    await expect(callout).toContainText('‘조사 결과 요약’을 직접 눌러');
    const finish = page.getByRole('button', { name: '리포트 확인 마치기', exact: true });
    await expect(finish).toBeDisabled();
    await page.locator('[data-guide-report-task="106"]').click();
    await expect(callout).toContainText('‘조사 결과 요약 문서’를 누르세요.');
    const material = page.locator('[data-guide-report-material="1005"]');
    await expect(material).toHaveClass(/preview-guide-action-highlight/);
    await material.click();
    await expect(finish).toBeEnabled();
    await expect(callout).toContainText('연결된 문서를 열었습니다.');
    await expect(page.locator('[data-guide="report-material-preview"] .markdown-body')).toBeVisible();
    await material.click();
    await expect(finish).toBeDisabled();
    await expect(callout).toContainText('‘조사 결과 요약 문서’를 누르세요.');
    await material.click();
    await expect(finish).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await finish.click();
    await expect(page.getByRole('heading', { name: '내 기여도 확인하기 완료', exact: true })).toBeVisible();
    await expect(callout).toHaveCount(0);
  });
}
