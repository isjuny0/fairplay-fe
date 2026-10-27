import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';
import { fillDateTime } from './helpers/dateTime.js';

async function openManagerPreview(page, path, scenario = 'active') {
  await page.goto('/preview/main');
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  await selectPreviewOption(page, '미리보기 역할', 'manager');
  await selectPreviewOption(page, '미리보기 상황', scenario);
  await page.goto(`/preview${path}`);
}

for (const width of [1440, 320]) {
  test(`평가 회차 ${width}px: 결과 원문을 중복 표시하지 않고 평가 결과 탭으로 전환한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openManagerPreview(page, '/spaces/1/rounds', 'review');
    await expect(page.getByRole('region', { name: '관리자 동료 평가 상세' })).toHaveCount(0);
    await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
    await expect(page).toHaveURL(/rounds\?tab=peer-responses/);
    const panel = page.getByRole('region', { name: '관리자 동료 평가 상세' });
    await panel.getByRole('button', { name: '김하늘 받은 평가 2건', exact: true }).click();
    const table = panel.getByRole('table', { name: '김하늘님이 받은 최종 제출 평가', exact: true });
    await expect(table.getByRole('rowheader')).toHaveText(['이지원', '박서연']);
    for (const criterion of ['작업 수행', '책임감', '적극성', '의사소통'])
      await expect(table.getByRole('columnheader', { name: criterion, exact: true })).toHaveCount(1);
    await expect(table.getByText('작성한 사유', { exact: true })).toHaveCount(2);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

for (const width of [1440, 1280, 390]) {
  test(`평가 결과 ${width}px: 한 팀원의 점수와 사유를 읽고 대상과 회차를 전환한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openManagerPreview(page, '/spaces/1/rounds?teamId=1&tab=peer-responses', 'review');
    const panel = page.getByRole('region', { name: '관리자 동료 평가 상세', exact: true });
    await expect(panel.locator('.manager-peer-fixed-team')).toHaveCount(0);
    await expect(panel.getByRole('combobox', { name: '결과 조회 회차', exact: true }).getByRole('option')).toHaveText(['중간 평가', '최종 평가']);
    await expect(panel.getByRole('button', { name: /새로고침/ })).toHaveCount(1);
    await expect(panel.getByRole('group', { name: '평가 제출 현황' })).toContainText('3 / 3명');
    const targets = panel.getByRole('navigation', { name: '평가받은 팀원', exact: true });
    await expect(targets.getByRole('button')).toHaveCount(3);
    const selected = panel.getByRole('region', { name: '선택한 팀원 받은 평가', exact: true });
    await expect(selected.getByRole('table')).toHaveCount(1);
    await expect(selected.getByRole('heading', { name: '이지원님이 받은 평가', exact: true })).toBeVisible();
    await expect(selected.locator('.manager-peer-reason-row')).toHaveCount(2);
    const next = targets.getByRole('button', { name: '김하늘 받은 평가 2건', exact: true });
    await next.focus();
    await next.press('Enter');
    await expect(next).toHaveAttribute('aria-pressed', 'true');
    await expect(next).toBeFocused();
    await expect(selected.getByRole('heading', { name: '김하늘님이 받은 평가', exact: true })).toBeVisible();
    await expect(selected.getByRole('table', { name: '이지원님이 받은 최종 제출 평가' })).toHaveCount(0);
    await expect(selected.getByText('작성한 사유', { exact: true })).toHaveCount(2);
    await panel.getByRole('button', { name: '평가 결과 새로고침', exact: true }).click();
    await expect(selected.getByRole('table', { name: '김하늘님이 받은 최종 제출 평가', exact: true })).toBeVisible();
    await panel.getByRole('combobox', { name: '결과 조회 회차', exact: true }).selectOption('12');
    await expect(page).toHaveURL(/tab=peer-responses/);
    await expect(page).toHaveURL(/teamId=1/);
    await expect(page).toHaveURL(/peerRoundId=12/);
    await page.reload();
    await expect(panel.getByRole('combobox', { name: '결과 조회 회차', exact: true })).toHaveValue('12');
    await expect(selected.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

for (const width of [1440, 1280, 390]) {
  test(`동료 평가 관리 ${width}px: 두 회차를 비교하고 팀별 제출 현황은 상세창에서 확인한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openManagerPreview(page, '/spaces/1/rounds');
    const overview = page.getByRole('region', { name: '평가 회차 일정과 제출 현황', exact: true });
    await expect(overview.getByRole('columnheader')).toHaveText(['평가 회차', '진행 상태', '평가 기간', '제출 현황', '관리']);
    await expect(overview.locator('tbody > tr')).toHaveCount(2);
    await expect(overview.getByRole('rowheader')).toHaveText(['중간 평가', '최종 평가']);
    await expect(overview.getByRole('button', { name: '최종 평가 마감 시각 수정', exact: true })).toBeEnabled();
    await expect(overview.getByRole('button', { name: '중간 평가 일정 수정', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const detail = overview.getByRole('button', { name: '최종 평가 팀별 제출 현황 보기', exact: true });
    await detail.focus();
    await detail.press('Enter');
    const dialog = page.getByRole('dialog', { name: '최종 평가 팀별 제출 현황', exact: true });
    await expect(dialog.getByRole('rowheader')).toHaveText(['삼위일체', '파도']);
    await expect(dialog).toContainText('0 / 3명');
    await expect(dialog.getByRole('progressbar', { name: '최종 평가 삼위일체 제출률' })).toHaveAttribute('aria-valuenow', '0');
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(detail).toBeFocused();
    await page.getByText('평가 운영 기준', { exact: true }).click();
    await expect(page.getByText('중간 평가 마감 후 최종 평가를 시작할 수 있습니다.', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [1440, 1280, 390]) {
  test(`관리자는 ${width}px에서 팀 목록에서 수행 현황을 바로 조회하고 조건을 복원한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
    await openManagerPreview(page, '/spaces/1/dashboard');
    await expect(page.getByRole('heading', { name: '먼저 확인할 팀', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '전체 팀 현황', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('조회할 팀')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '평가 운영 화면' })).toHaveCount(0);
    await expect(page.getByText('현황 읽는 법', { exact: true })).toHaveCount(0);
    const helpItems = width > 720 ? [['팀 진행률', '예상 작업량'], ['확인 사항', '48시간']] : [['팀 진행률', '예상 작업량'], ['마감 지연', '마감 시각'], ['장기 정체', '48시간']];
    for (const [label, expected] of helpItems) {
      const metricHelp = page.getByRole('button', { name: `${label} 집계 기준`, exact: true }).first();
      await metricHelp.focus();
      await expect(page.getByRole('tooltip')).toContainText(expected);
      await metricHelp.press('Escape');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    }
    const filters = page.getByRole('group', { name: '팀 빠른 필터', exact: true });
    await filters.getByRole('button', { name: '마감 지연', exact: true }).click();
    await expect(page.getByLabel('팀 상태', { exact: true })).toHaveValue('overdue');
    await page.getByLabel('팀·리더 검색', { exact: true }).fill('삼위일체');
    await page.getByLabel('팀 정렬', { exact: true }).selectOption('progress');
    if (width > 720) {
      const table = page.getByRole('table', { name: '팀 관리', exact: true });
      await expect(table.getByRole('columnheader')).toHaveText(['팀', '팀 진행률', '작업 현황', '확인 사항', '산출물', '리포트']);
      expect(await table.locator('tbody > tr').first().evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
      expect(await table.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(table.locator('tbody').getByRole('button', { name: /집계 기준/ })).toHaveCount(0);
      const taskCounts = table.locator('tbody tr').first().locator('.dashboard-team-work-counts');
      await expect(taskCounts.locator('dt')).toHaveText(['할 일', '진행 중', '수정 중', '완료']);
      await expect(taskCounts.locator('dd')).toHaveText(['1건', '1건', '1건', '3건']);
    }
    await page.getByRole('button', { name: '삼위일체 현황 보기', exact: true }).click();
    await expect(page).toHaveURL(/teamId=1/);
    await expect(page.getByRole('heading', { name: '삼위일체', exact: true })).toBeVisible();
    if (width > 720) {
      const teamBreadcrumb = page.getByRole('navigation', { name: '현재 위치', exact: true });
      await expect(teamBreadcrumb.getByRole('button')).toHaveText(['팀 관리']);
      await expect(teamBreadcrumb.locator('[aria-current="page"]')).toHaveText('삼위일체');
      await teamBreadcrumb.getByRole('button', { name: '팀 관리', exact: true }).click();
      await expect(page.getByLabel('팀·리더 검색', { exact: true })).toHaveValue('삼위일체');
      await expect(page.getByLabel('팀 상태', { exact: true })).toHaveValue('overdue');
      await page.getByRole('button', { name: '삼위일체 현황 보기', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: '삼위일체', exact: true })).toBeVisible();
    await expect(page.getByLabel('조회할 팀')).toHaveCount(0);
    await expect(page.getByRole('tablist', { name: '팀 상세 보기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '평가 제출 현황', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '팀원 수행 현황', exact: true })).toBeVisible();
    const help = page.getByRole('button', { name: '장기 정체 집계 기준', exact: true });
    await help.focus();
    await expect(page.getByRole('tooltip')).toContainText('48시간');
    await help.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '팀원 수행 현황', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '김하늘 수행 상세', exact: true }).click();
    await expect(page.getByRole('heading', { name: '김하늘님의 수행 상세', exact: true })).toBeVisible();
    if (width > 720) {
      const breadcrumb = page.getByRole('navigation', { name: '현재 위치', exact: true });
      await expect(breadcrumb.getByRole('button')).toHaveText(['팀 관리', '삼위일체']);
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('김하늘님의 수행 상세');
      await breadcrumb.getByRole('button', { name: '삼위일체', exact: true }).click();
      await expect(page.getByRole('heading', { name: '삼위일체', exact: true })).toBeVisible();
      await expect(page.getByLabel('조회할 팀')).toHaveCount(0);
      await page.getByRole('button', { name: '김하늘 수행 상세', exact: true }).click();
    }
    await page.getByRole('button', { name: '← 팀 관리', exact: true }).click();
    await expect(page.getByRole('heading', { name: '삼위일체', exact: true })).toBeVisible();
    await expect(page.getByLabel('조회할 팀')).toHaveCount(0);
    await page.getByRole('button', { name: '← 팀 목록', exact: true }).click();
    await expect(page.getByLabel('조회할 팀')).toHaveCount(0);
    await expect(page.getByLabel('팀·리더 검색', { exact: true })).toHaveValue('삼위일체');
    await expect(page.getByLabel('팀 상태', { exact: true })).toHaveValue('overdue');
    await expect(page.getByLabel('팀 정렬', { exact: true })).toHaveValue('progress');
    await expect(filters.getByRole('button', { name: '마감 지연', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(new URL(page.url()).searchParams.has('teamId')).toBe(false);
    expect(new URL(page.url()).searchParams.has('tab')).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [1440, 390]) {
  test(`스페이스 관리 ${width}px: 팀 빌딩과 참여 코드를 나누고 미저장 입력을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openManagerPreview(page, '/spaces/1/settings', 'building');
    const periodTab = page.getByRole('tab', { name: '팀 빌딩 기간', exact: true });
    const codeTab = page.getByRole('tab', { name: '참여 코드', exact: true });
    await expect(periodTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: '코드 새로고침', exact: true })).toBeHidden();
    await fillDateTime(page, '팀 빌딩 시작', '2026-09-01T10:00');
    await codeTab.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/#join-code$/);
    await expect(page.getByRole('button', { name: '코드 새로고침', exact: true })).toBeVisible();
    await expect(page.getByLabel('팀 빌딩 시작 날짜', { exact: true })).toBeHidden();
    // Code actions may refresh the space version; they must not reset the other tab's draft.
    await page.getByRole('button', { name: /새 코드로 재발급|참여 코드 발급/, exact: true }).click();
    await periodTab.click();
    await expect(page.getByLabel('팀 빌딩 시작 날짜', { exact: true })).toHaveValue('2026-09-01');
    await codeTab.focus();
    await codeTab.press('Enter');
    await page.getByRole('button', { name: 'Fairplay', exact: true }).click();
    const warning = page.getByRole('dialog', { name: '저장하지 않은 변경 사항', exact: true });
    await expect(warning).toBeVisible();
    await warning.getByRole('button', { name: '계속 작성', exact: true }).click();
    await periodTab.click();
    await expect(page.getByLabel('팀 빌딩 시작 날짜', { exact: true })).toHaveValue('2026-09-01');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await codeTab.click();
    await page.reload();
    await expect(codeTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: '코드 새로고침', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('팀 빌딩 기간은 저장된 값과 저장 전 입력을 구분하고 저장한 후 현재 기간을 갱신한다', async ({
  page,
}) => {
  await openManagerPreview(page, '/spaces/1/settings', 'building');
  const currentPeriod = page.getByLabel('저장된 팀 빌딩 기간', { exact: true });
  const storedText = await currentPeriod.textContent();
  await fillDateTime(page, '팀 빌딩 시작', '2026-09-01T10:00');
  await expect(currentPeriod).toHaveText(storedText);
  await expect(
    page.getByRole('status').filter({ hasText: '저장 전 입력' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '팀 빌딩 기간을 저장했습니다.' }),
  ).toBeVisible();
  await expect(currentPeriod).toContainText('2026. 09. 01. 10:00');
  await expect(
    page.getByRole('status').filter({ hasText: '저장 전 입력' }),
  ).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`관리자는 ${width}px에서 팀 목록을 검색·필터하고 조회 조건을 복원한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openManagerPreview(page, '/spaces/1/dashboard');
    const summary = page.getByRole('region', {
      name: '조회 범위의 작업 현황',
      exact: true,
    });
    await page.getByLabel('팀·리더 검색', { exact: true }).fill('최유진');
    await expect(
      page.getByRole('status').filter({ hasText: '목록 1 / 2팀' }),
    ).toBeVisible();
    const table = page.getByRole('table', {
      name: '팀 관리',
      exact: true,
    });
    if (width > 720) {
      await expect(
        table.getByRole('button', { name: '파도 현황 보기', exact: true }),
      ).toBeVisible();
      await expect(
        table.getByRole('button', { name: '삼위일체 현황 보기', exact: true }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole('button', { name: '파도 현황 보기', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: '삼위일체 현황 보기', exact: true }),
      ).toHaveCount(0);
    }
    await expect(summary).toHaveCount(0);
    await page.getByLabel('팀 상태', { exact: true }).selectOption('overdue');
    await page.getByLabel('팀 정렬', { exact: true }).selectOption('progress');
    await page.reload();
    await expect(page.getByLabel('팀·리더 검색', { exact: true })).toHaveValue(
      '최유진',
    );
    await expect(page.getByLabel('팀 상태', { exact: true })).toHaveValue(
      'overdue',
    );
    await expect(page.getByLabel('팀 정렬', { exact: true })).toHaveValue(
      'progress',
    );
    await page
      .getByLabel('팀 상태', { exact: true })
      .selectOption('applications');
    await expect(
      page.getByText('조건에 맞는 팀이 없습니다.', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '목록 조건 초기화', exact: true })
      .last()
      .click();
    await expect(page.getByLabel('팀·리더 검색', { exact: true })).toHaveValue(
      '',
    );
    await expect(page.getByLabel('팀 상태', { exact: true })).toHaveValue(
      'all',
    );
    await expect(page.getByLabel('팀 정렬', { exact: true })).toHaveValue(
      'name',
    );
    await expect(
      page.getByRole('status').filter({ hasText: '목록 2 / 2팀' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: '파도 현황 보기', exact: true })
      .click();
    await expect(page).toHaveURL(/teamId=2/);
    await expect(
      page.getByRole('heading', { name: '팀원 수행 현황', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('팀·리더 검색', { exact: true })).toHaveCount(
      0,
    );
  });
}

for (const width of [1440, 1280, 390]) {
  test(`수행 상세 ${width}px: 작업을 선택하고 필터·평가 탭·새로고침에서 맥락을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openManagerPreview(page, '/spaces/1/manager/teams/1/members/00000000-0000-4000-8000-000000000001', 'review');
    const list = page.getByRole('navigation', { name: '담당 작업 목록', exact: true });
    await expect(list.getByRole('button')).toHaveCount(4);
    await expect(page.getByRole('region', { name: '선택한 작업 기록', exact: true })).toHaveCount(1);
    const next = list.getByRole('button').nth(1);
    const title = await next.locator('strong').textContent();
    await next.focus();
    await next.press('Enter');
    await expect(next).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('region', { name: '선택한 작업 기록' }).getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/taskId=/);
    await page.reload();
    await expect(page.getByRole('region', { name: '선택한 작업 기록' }).getByRole('heading', { name: title, exact: true })).toBeVisible();
    const work = page.getByRole('tab', { name: '작업 기록', exact: true });
    await work.focus();
    await work.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '동료 평가 결과', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: '팀원의 동료 평가 결과' })).toBeVisible();
    await expect(list).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('tab', { name: '동료 평가 결과', exact: true })).toHaveAttribute('aria-selected', 'true');
    await work.click();
    await expect(page.getByRole('region', { name: '선택한 작업 기록' }).getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: '조회할 작업 상태', exact: true }).selectOption('DONE');
    await expect(list.getByRole('button')).toHaveCount(2);
    await expect(page.getByRole('region', { name: '선택한 작업 기록' }).getByText('완료', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [1440, 390, 320]) {
  test(`팀 조회 바로가기 ${width}px: 현황에서 작업·산출물을 조회하고 목록 조건을 유지한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const requests = [];
    page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request); });
    await openManagerPreview(page, '/spaces/1/dashboard?teamQuery=삼위일체&teamFilter=overdue&teamSort=progress');
    await page.getByRole('button', { name: '삼위일체 현황 보기', exact: true }).click();
    const links = page.getByRole('navigation', { name: '팀 조회 바로가기', exact: true });
    await links.getByRole('button', { name: '작업 보기', exact: true }).click();
    await expect(page).toHaveURL(/teams\/1\/tasks(?:\?|$)/);
    await expect(page.getByRole('heading', { name: '작업', exact: true })).toBeVisible();
    await expect(links.getByRole('button', { name: '팀원 보기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '새 작업 만들기', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '승인', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '반려', exact: true })).toHaveCount(0);
    if (width > 720) {
      const sidebar = page.getByRole('navigation', { name: '스페이스 메뉴', exact: true });
      await expect(sidebar.getByRole('navigation', { name: '팀 메뉴', exact: true })).toHaveCount(0);
      await expect(sidebar.getByText('팀 자료 조회', { exact: true })).toHaveCount(0);
      await expect(sidebar.getByRole('button', { name: '팀 관리', exact: true })).toHaveAttribute('aria-current', 'page');
      const breadcrumb = page.getByRole('navigation', { name: '현재 위치', exact: true });
      await expect(breadcrumb.getByRole('button')).toHaveText(['팀 관리', '삼위일체']);
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('작업');
    }
    await page.getByRole('group', { name: '작업 보기 방식' }).getByRole('button', { name: '목록', exact: true }).click();
    await page.getByRole('button', { name: '서비스 흐름 설계', exact: true }).click();
    await expect(page.getByRole('heading', { name: '서비스 흐름 설계', exact: true })).toBeVisible();
    for (const label of ['작업 수정', '작업 삭제', '완료 처리', '수정 중으로 전환', '수행 설명 저장'])
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'AI피드백', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
    await links.getByRole('button', { name: '산출물 보기', exact: true }).click();
    await expect(page).toHaveURL(/teams\/1\/deliverables$/);
    await expect(page.getByRole('heading', { name: '산출물 관리', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '산출물 등록', exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: '산출물 유형', exact: true }).selectOption('TEXT');
    await page.reload();
    await expect(links.getByRole('button', { name: '산출물 보기', exact: true })).toHaveAttribute('aria-current', 'page');
    await links.getByRole('button', { name: '← 팀 현황', exact: true }).click();
    await expect(page.getByRole('heading', { name: '삼위일체', exact: true })).toBeVisible();
    await expect(page.getByLabel('조회할 팀')).toHaveCount(0);
    await page.getByRole('button', { name: '← 팀 목록', exact: true }).click();
    await expect(page.getByLabel('팀·리더 검색', { exact: true })).toHaveValue('삼위일체');
    await expect(page.getByLabel('팀 상태', { exact: true })).toHaveValue('overdue');
    await expect(page.getByLabel('팀 정렬', { exact: true })).toHaveValue('progress');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(requests).toHaveLength(0);
  });
}

for (const width of [1440, 1280, 390]) {
  test(`스페이스 운영 ${width}px: 메뉴와 하위 탭을 바꿔도 제목·탭·본문 기준선이 유지된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openManagerPreview(page, '/spaces/1/dashboard');
    let baseline, tabBaseline;
    for (const path of ['dashboard', 'rounds', 'rounds?tab=peer-responses', 'reports', 'settings', 'settings#join-code']) {
      await page.goto(`/preview/spaces/1/${path}`);
      const screen = page.locator('.space-operation-page');
      await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
      const layout = await screen.evaluate((element) => {
        const bounds = (node) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        };
        const tablist = element.querySelector('[role="tablist"]');
        return { canvas: bounds(element), heading: bounds(element.querySelector(':scope > .page-heading')), title: bounds(element.querySelector('h1')), tabs: tablist ? bounds(tablist) : null };
      });
      baseline ||= layout;
      for (const key of ['x', 'width']) expect(Math.abs(layout.canvas[key] - baseline.canvas[key])).toBeLessThan(1);
      for (const key of ['x', 'y', 'height']) expect(Math.abs(layout.heading[key] - baseline.heading[key])).toBeLessThan(1);
      for (const key of ['x', 'y', 'height']) expect(Math.abs(layout.title[key] - baseline.title[key])).toBeLessThan(1);
      if (layout.tabs) {
        tabBaseline ||= layout.tabs;
        for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(layout.tabs[key] - tabBaseline[key])).toBeLessThan(1);
      }
      if (path.startsWith('settings')) {
        const settingsBody = page.locator('.settings-tab-panel:not([hidden]) .settings-section-content');
        await expect(settingsBody).toBeVisible();
        expect(Math.abs((await settingsBody.boundingBox()).x - layout.canvas.x)).toBeLessThan(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
