import { test, expect } from '@playwright/test';

async function openPreview(page, path, role = 'leader') {
  await page.addInitScript(
    (role) => localStorage.setItem('fairplay:preview-role', role),
    role,
  );
  await page.goto(`/preview${path}`);
}

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`${width}px 리더 표시는 헤더 이름 옆 한 줄에만 표시한다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await openPreview(page, '/spaces/1/teams/1/tasks/103');
    await expect(
      page.getByRole('heading', { name: '서비스 흐름 설계', exact: true }),
    ).toBeVisible();
    const identity = page.locator('.topbar .profile-identity');
    const name = identity.locator('.profile-name');
    const role = identity.locator('.profile-leader-badge');
    await expect(name).toBeVisible();
    await expect(name).toHaveText('김하늘');
    await expect(role).toHaveText('리더');
    await expect(page.locator('.breadcrumb-role')).toHaveCount(0);
    await expect(page.locator('.mobile-workspace-context')).not.toContainText(
      '리더',
    );
    await page.evaluate(() => document.fonts.ready);
    const nameBox = await name.boundingBox(),
      roleBox = await role.boundingBox();
    expect(roleBox.x - nameBox.x - nameBox.width).toBeGreaterThanOrEqual(4);
    expect(
      Math.abs(nameBox.y + nameBox.height / 2 - roleBox.y - roleBox.height / 2),
    ).toBeLessThan(1);
    expect(roleBox.x + roleBox.width).toBeLessThanOrEqual(width);
    const logoBox = await page
      .locator('.topbar-brand .brand-logo')
      .boundingBox();
    expect(logoBox.width).toBeGreaterThan(logoBox.height * 3);
    await expect(page.locator('.topbar-brand .brand-logo')).toHaveAttribute('src', '/branding/fairplay-logo.webp');
    expect(
      await page
        .locator('.topbar')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: '미리보기 종료', exact: true }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: '미리보기 설정', exact: true })
      .click();
    const popover = page.getByRole('region', {
      name: '미리보기 설정',
      exact: true,
    });
    await expect(popover).toBeVisible();
    const popoverBox = await popover.boundingBox();
    const headerBox = await page.locator('.topbar').boundingBox();
    expect(popoverBox.x).toBeGreaterThanOrEqual(0);
    expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(width);
    expect(popoverBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    await page
      .getByRole('button', { name: '미리보기 설정 닫기', exact: true })
      .click();
    await page.screenshot({ path: testInfo.outputPath('header-leader.png') });
    await page.getByRole('button', { name: 'Fairplay', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '내 스페이스', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.profile-leader-badge')).toHaveCount(0);
  });
}

for (const role of ['member', 'teammate', 'manager', 'participant']) {
  test(`${role}에게는 팀 리더 표시를 잘못 붙이지 않는다`, async ({ page }) => {
    await openPreview(
      page,
      role === 'manager' ? '/spaces/1/dashboard' : '/spaces/1/teams/1/members',
      role,
    );
    await expect(page.locator('.topbar .profile-name')).not.toHaveText('');
    await expect(page.locator('.profile-leader-badge')).toHaveCount(0);
  });
}

test('다른 팀으로 이동해도 이전 팀의 리더 표시가 남지 않는다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/teams/1');
  await expect(page.locator('.profile-leader-badge')).toHaveText('리더');
  await page.getByRole('button', { name: '내 스페이스', exact: true }).click();
  await expect(page.locator('.profile-leader-badge')).toHaveCount(0);
  await page.goto('/preview/spaces/1/teams/2');
  await expect(page.locator('.topbar .profile-name')).toHaveText('김하늘');
  await expect(page.locator('.profile-leader-badge')).toHaveCount(0);
});

for (const [path, selector, text] of [
  ['/main', '.space-page-home-label', '홈'],
  ['/spaces/1', '.space-home-eyebrow', '스페이스 홈'],
  ['/spaces/1/teams/1', '.dashboard-eyebrow', '팀 홈'],
]) {
  test(`${text} 화면은 기존 초록색 제목 위 문구를 유지한다`, async ({
    page,
  }) => {
    await openPreview(page, path);
    await expect(page.locator(selector)).toHaveText(text);
    await expect(page.locator(selector)).toHaveCSS('color', 'rgb(8, 124, 85)');
  });
}

for (const [path, heading, role = 'leader'] of [
  ['/spaces/1/teams/1/tasks', '작업'],
  ['/spaces/1/teams/1/tasks/103', '서비스 흐름 설계'],
  ['/spaces/1/teams/1/deliverables', '산출물 관리'],
  ['/spaces/1/teams/1/meeting-minutes', '팀 회의록'],
  ['/spaces/1/teams/1/materials-search', '팀 자료 검색'],
  ['/spaces/1/teams/1/members', '팀원 관리'],
  ['/spaces/1/teams/1/settings', '팀 설정'],
  ['/spaces/1/teams/1/peer-evaluations', '동료 평가'],
  ['/spaces/1/teams/1/mid-feedback', '중간 피드백'],
  ['/spaces/1/teams/1/reports', '기여도 리포트'],
  ['/spaces/1/dashboard', '팀 관리', 'manager'],
  ['/spaces/1/participants', '참여자 관리', 'manager'],
  ['/spaces/1/rounds', '동료 평가 관리', 'manager'],
  ['/spaces/1/reports', '리포트 관리', 'manager'],
  ['/spaces/1/settings', '스페이스 관리', 'manager'],
  [
    '/spaces/1/manager/teams/1/members/00000000-0000-4000-8000-000000000001',
    '김하늘님의 수행 상세',
    'manager',
  ],
]) {
  test(`${heading} 제목 위의 장식용 초록 문구를 제거한다`, async ({ page }) => {
    await openPreview(page, path, role);
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator('.page-heading .eyebrow')).toHaveCount(0);
  });
}

test('AI 제목 위의 장식용 초록 문구도 제거한다', async ({ page }) => {
  await openPreview(page, '/spaces/1/teams/1/tasks/103');
  await page.getByRole('tab', { name: 'AI피드백', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'AI 검토', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.ai-review-heading .eyebrow')).toHaveCount(0);
});

test('리포트·관리자 원문 제목 위 문구를 제거하고 상태 표시는 유지한다', async ({
  page,
}) => {
  await openPreview(page, '/spaces/1/reports', 'manager');
  await page.evaluate(async () => {
    const { resetMockState } = await import('/src/mock/planned.js');
    const { previewContext } = await import('/src/mock/preview.js');
    resetMockState(previewContext(), 'published');
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '팀원별 최종 기여율', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.report-team-result .eyebrow')).toHaveCount(0);
  await expect(
    page.locator('.report-metadata > .status-badge'),
  ).toHaveText('공개 완료');
  await page.goto('/preview/spaces/1/rounds?tab=peer-responses');
  await expect(
    page.getByRole('heading', { name: '동료 평가 관리', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: '동료 평가 결과', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: '관리자 동료 평가 상세', exact: true })).toBeVisible();
  await expect(page.locator('.manager-peer-heading .eyebrow')).toHaveCount(0);
});
