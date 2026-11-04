import { selectPreviewOption } from './helpers/previewControls.js';
import { test, expect } from '@playwright/test';
import { addDashboardWidgets, clickDashboardControl } from './helpers/teamDashboard.js';

async function preview(page, path, role = 'leader', scenario = 'active') {
  await page.goto('/preview/main');
  await page.locator('.preview-toolbar').waitFor({ state: 'visible' });
  if (!(await page.getByLabel('미리보기 역할').isVisible()))
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  await selectPreviewOption(page, '미리보기 역할', role);
  if (scenario !== 'active')
    await selectPreviewOption(page, '미리보기 상황', scenario);
  await page.goto(`/preview${path}`);
  if (
    (await page.getByRole('button', { name: '미리보기 설정', exact: true }).isVisible()) &&
    (await page.getByLabel('미리보기 역할').isVisible())
  )
    await page.getByRole('button', { name: '미리보기 설정', exact: true }).click();
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1 }),
  ).toBeVisible();
}

test('새 화면은 상단과 제목에서 시작하고 목록 복귀는 필터와 스크롤을 복원한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 });
  await preview(page, '/spaces/1/teams/1/tasks?mine=1');
  const task = page.getByRole('button', {
    name: '스페이스·팀 권한 설계',
    exact: true,
  });
  await task.scrollIntoViewIfNeeded();
  const position = await page.evaluate(() => window.scrollY);
  expect(position).toBeGreaterThan(300);
  await task.click();
  await expect(
    page.getByRole('heading', { name: '스페이스·팀 권한 설계', level: 1 }),
  ).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: '← 목록으로', exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname.endsWith('/tasks') &&
      url.searchParams.get('mine') === '1' &&
      url.searchParams.get('view') === 'board',
  );
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - position),
    )
    .toBeLessThan(20);
  await expect(page.getByLabel('내 담당 작업만')).toBeChecked();
  await task.click();
  await page.goBack();
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - position),
    )
    .toBeLessThan(20);
  await page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true}).click();
  await page
    .getByRole('navigation', { name: '팀 메뉴', exact:true })
    .getByRole('button', { name: '팀 자료', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '팀 자료', level: 1 }),
  ).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('완료 준비 상태는 미작성 담당자를 표시하고 전원 작성 뒤 완료할 수 있다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/102');
  const readiness = page.getByRole('list', { name: '완료 준비 상태' });
  const assignments = page.getByRole('table', { name: '담당자별 수행 상태' });
  await expect(
    readiness.getByRole('img', { name: '충족', exact: true }),
  ).toHaveCount(2);
  await expect(
    readiness.getByRole('img', { name: '미충족', exact: true }),
  ).toHaveCount(0);
  await expect(readiness.getByRole('checkbox')).toHaveCount(0);
  await expect(readiness).not.toContainText('✓');
  await expect(readiness).not.toContainText('○');
  await expect(assignments.getByRole('row').filter({ hasText: '김영진' })).toContainText('미작성');
  await expect(readiness).toContainText('결과물 추가됨');
  await expect(
    page.getByRole('button', { name: '완료 처리', exact: true }),
  ).toBeDisabled();
  await preview(page, '/spaces/1/teams/1/tasks/102', 'member');
  await page.getByRole('tab', { name: '수행 설명', exact: true }).click();
  await page
    .getByLabel('내 수행 설명', { exact: true })
    .fill('설문 응답을 분류하고 검증 근거와 한계를 작성했습니다.');
  await page
    .getByRole('button', { name: '수행 설명 저장', exact: true })
    .click();
  await expect(assignments.getByRole('row').filter({ hasText: '김영진' })).toContainText('작성 완료');
  await expect(
    readiness.getByRole('img', { name: '충족', exact: true }),
  ).toHaveCount(2);
  await expect(
    readiness.getByRole('img', { name: '미충족', exact: true }),
  ).toHaveCount(0);
  await preview(page, '/spaces/1/teams/1/tasks/102', 'leader');
  await expect(assignments.getByRole('row').filter({ hasText: '김영진' })).toContainText('작성 완료');
  await expect(
    page.getByRole('button', { name: '완료 처리', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '완료 처리', exact: true }).click();
  await page
    .getByRole('dialog', { name: '작업 완료', exact: true })
    .getByRole('button', { name: '완료 처리', exact: true })
    .click();
  await expect(
    page.getByText('작업을 완료했습니다.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '작업 수정', exact: true }),
  ).toHaveCount(0);
});

test('모바일 관리자는 통합 메뉴에서 평가와 리포트로 이동한다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preview(page, '/spaces/1/dashboard', 'manager');
  await page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true}).click();
  const navigation = page.locator('.manager-workspace-navigation');
  await expect(navigation.getByRole('button')).toHaveCount(5);
  await expect(navigation.getByRole('button', { name: '참여자 관리', exact: true })).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const boxes = await navigation.getByRole('button').evaluateAll((buttons) => buttons.map((button) => ({ top: button.getBoundingClientRect().top, fits: button.scrollWidth <= button.clientWidth })));
    expect(boxes.every((box) => box.fits)).toBe(true);
  }
  await expect(page.getByLabel('스페이스 선택', { exact: true })).toBeHidden();
  await navigation.getByRole('button', { name: '동료 평가 관리', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '동료 평가 관리', level: 1 }),
  ).toBeVisible();
  await page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true}).click();
  await navigation.getByRole('button', { name: '리포트 관리', exact: true }).click();
  const readiness = page.getByRole('list', { name: '팀별 리포트 준비 상태' });
  await expect(readiness.getByRole('listitem')).toHaveCount(2);
  await expect(readiness).toContainText('중간·최종 평가를 모두 마감해 주세요.');
  await expect(
    page.getByRole('button', { name: '전체 리포트 생성', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button',{name:'스페이스 메뉴 펼치기',exact:true}).click();
  await navigation.getByRole('button', { name: '동료 평가 관리', exact: true }).click();
  await expect(page).toHaveURL(/spaces\/1\/rounds$/);
});

test('모바일 고급 필터는 접혀 있고 통합 메뉴에 현재 위치를 표시한다', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preview(page, '/spaces/1/teams/1/tasks');
  await expect(page.getByLabel('작업 제목 검색')).toBeVisible();
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('mobile-task-board.png') });
  await page.getByRole('button', { name: '필터', exact: true }).click();
  await page.getByLabel('내 담당 작업만').check();
  await page.getByLabel('작업 정렬').selectOption('newest');
  await expect(
    page.getByRole('button', { name: '필터 · 2', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '필터 · 2', exact: true }).click();
  await expect(page.getByLabel('작업 정렬')).toBeHidden();
  await page.getByRole('button', {name:'스페이스 메뉴 펼치기',exact:true}).click();
  await page
    .getByRole('button', { name: '기여도 리포트', exact: true })
    .click();
  await expect(page.locator('.mobile-menu-location')).toContainText('기여도 리포트');
  await expect(
    page.getByRole('button', { name: '리포트 새로고침', exact: true }),
  ).toBeVisible();
});

for (const width of [1440, 390])
  test(`점수와 기준 정렬 ${width}px 및 입력 오류 초점`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await preview(page, '/spaces/1/teams/1/peer-evaluations');
    await page
      .getByRole('button', { name: '김영진 평가 저장', exact: true })
      .click();
    await expect(
      page.getByLabel('김영진 작업 수행 1점', { exact: true }),
    ).toBeFocused();
    const card = page.locator('.peer-card[aria-label="김영진 동료 평가 입력"]');
    const criterion = card.getByRole('group', {
      name: '작업 수행',
      exact: true,
    });
    for (const [labelIndex, scoreIndex] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]) {
      const label = await criterion
        .locator('.score-scale > span')
        .nth(labelIndex)
        .boundingBox();
      const score = await criterion
        .locator('.score-options label')
        .nth(scoreIndex)
        .boundingBox();
      expect(
        Math.abs(label.x + label.width / 2 - score.x - score.width / 2),
      ).toBeLessThan(2);
    }
    for (const criterion of ['작업 수행', '책임감', '적극성', '의사소통'])
      await page.getByLabel(`김영진 ${criterion} 2점`, { exact: true }).check();
    await page
      .getByRole('button', { name: '김영진 평가 저장', exact: true })
      .click();
    await expect(card.getByLabel('평가 사유', { exact: true })).toBeFocused();
    await expect(card.getByLabel('평가 사유', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

test('완료 준비 목록에서 내 수행 설명으로 이동하고 변경된 내용만 저장한다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/102', 'member');
  const save = page.getByRole('button', {
    name: '수행 설명 저장',
    exact: true,
  });
  const description = page.getByLabel('내 수행 설명', { exact: true });
  await page
    .getByRole('button', { name: '내 수행 설명 작성', exact: true })
    .click();
  await expect(
    page.getByRole('tab', { name: '수행 설명', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(save).toBeDisabled();
  await expect(description).toBeFocused();
  const value = '응답을 분류하고 분석 기준과 검증 결과를 정리했습니다.';
  await description.fill(value);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
  await description.fill(` ${value} `);
  await expect(save).toBeDisabled();
  await expect(
    page.getByText('저장하지 않은 수행 설명이 있습니다.', { exact: true }),
  ).toHaveCount(0);
});

test('연결된 결과물이 없으면 준비 목록에서 등록 영역으로 바로 이동한다', async ({
  page,
}) => {
  await preview(page, '/spaces/1/teams/1/tasks/104', 'member');
  const readiness = page.getByRole('list', { name: '완료 준비 상태' });
  await expect(
    readiness
      .getByRole('listitem')
      .filter({ hasText: '작업 진행 중' })
      .getByRole('img', { name: '미충족', exact: true }),
  ).toBeVisible();
  await expect(
    readiness
      .getByRole('listitem')
      .filter({ hasText: '결과물 없음' })
      .getByRole('img', { name: '미충족', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '결과물 확인', exact: true }).click();
  await expect(page.locator('#task-deliverables-section')).toBeFocused();
  await expect(
    page.getByRole('button', { name: '결과물 추가', exact: true }),
  ).toBeInViewport();
});

test('팀 홈의 7일 내 마감 건수와 목록이 일치하고 위젯 설정은 유지된다', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T09:00:00Z'));
  await preview(page, '/spaces/1/teams/1');
  await addDashboardWidgets(page, ['지금 확인할 작업']);
  const catalog = page.getByRole('dialog', { name: '위젯 추가', exact: true });
  const soon = page.getByRole('button', { name: /7일 내 마감/ });
  const count = Number((await soon.innerText()).match(/\d+\s*건/)?.[0].replace(/\D/g, ''));
  expect(count).toBeGreaterThan(0);
  await soon.click();
  await expect(page).toHaveURL(/tasks\?mine=1&due=week&view=list$/);
  const list = page.getByRole('table', { name: '정렬된 작업 목록' });
  await expect(list.locator('tbody tr')).toHaveCount(count);
  await expect(list).not.toContainText('팀 자료 검색 개선');
  await expect(list).not.toContainText('전시 가이드 동선 점검');
  await expect(list).not.toContainText('스페이스·팀 권한 설계');
  await page.reload();
  await expect(list.locator('tbody tr')).toHaveCount(count);
  await page.getByRole('button', { name: '7일 내 마감 해제', exact: true }).click();
  await expect(list).toContainText('팀 자료 검색 개선');
  await page.goto('/preview/spaces/1/teams/1');
  await clickDashboardControl(page, '위젯 추가');
  await expect(catalog.getByRole('button', { name: '다가오는 작업 추가', exact: true })).toBeEnabled();
});
