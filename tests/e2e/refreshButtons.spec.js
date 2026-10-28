import { test, expect } from '@playwright/test';

const screens = [
  ['/main', '내 스페이스', '새로고침'],
  ['/spaces/1', '2026 서비스 디자인 프로젝트', '팀 목록 새로고침'],
  ['/spaces/1/announcements', '공지사항', '새로고침'],
  ['/spaces/1/teams/1', '삼위일체', '현황 새로고침'],
  ['/spaces/1/teams/1/tasks', '작업', '새로고침'],
  ['/spaces/1/teams/1/tasks/103', '서비스 흐름 설계', '새로고침'],
  ['/spaces/1/teams/1/deliverables', '산출물 관리', '새로고침'],
  ['/spaces/1/teams/1/materials-search', '팀 자료 검색', '팀 자료 새로고침'],
  ['/spaces/1/teams/1/members', '팀원 관리', '새로고침'],
  ['/spaces/1/teams/1/settings', '팀 설정', '현황 새로고침'],
  ['/spaces/1/teams/1/peer-evaluations', '동료 평가', '평가 상태 새로고침'],
  ['/spaces/1/teams/1/mid-feedback', '중간 피드백', '피드백 새로고침'],
  ['/spaces/1/teams/1/reports', '기여도 리포트', '리포트 새로고침'],
  ['/spaces/1/dashboard', '팀 관리', '현황 새로고침', 'manager'],
  ['/spaces/1/rounds', '동료 평가 관리', '회차·제출 현황 새로고침', 'manager'],
  [
    '/spaces/1/reports',
    '리포트 관리',
    '리포트 관리 새로고침',
    'manager',
  ],
  ['/spaces/1/settings#join-code', '스페이스 관리', '코드 새로고침', 'manager'],
  [
    '/spaces/1/manager/teams/1/members/00000000-0000-4000-8000-000000000001',
    '김하늘님의 수행 상세',
    '수행 상세 새로고침',
    'manager',
  ],
];

async function assertIconButton(button) {
  await expect(button).toBeVisible();
  await expect(button).toHaveText('');
  await expect(button).toHaveAttribute('type', 'button');
  const label = await button.getAttribute('aria-label');
  expect(label).toContain('새로고침');
  await expect(button).toHaveAttribute('title', label);
  await expect(button.locator('svg')).toHaveCount(1);
  await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  const box = await button.boundingBox();
  expect(box.width).toBe(40);
  expect(box.height).toBe(40);
}

for (const width of [1440, 390]) {
  for (const [path, heading, label, role = 'leader'] of screens) {
    test(`${width}px ${heading}의 새로고침은 이름·도움말을 유지하고 아이콘만 표시한다`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (role) => localStorage.setItem('fairplay:preview-role', role),
        role,
      );
      const errors = [],
        requests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/'))
          requests.push(request.url());
      });
      await page.goto(`/preview${path}`);
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();
      if (path.endsWith('/materials-search') && width < 900)
        await page
          .getByRole('button', { name: '팀 자료', exact: true })
          .click();
      const button = page.getByRole('button', { name: label, exact: true });
      await assertIconButton(button);
      await expect(button).toBeEnabled();
      const url = page.url();
      await button.click();
      await expect(button).toBeEnabled();
      await expect(page).toHaveURL(url);
      await assertIconButton(button);
      expect(errors).toEqual([]);
      expect(requests).toEqual([]);
      if (path.endsWith('/tasks/103') || path === '/spaces/1/reports')
        await page.screenshot({
          path: testInfo.outputPath('refresh-icons.png'),
          fullPage: true,
        });
    });
  }
}

test('작업 상세의 산출물과 댓글 새로고침은 모두 아이콘만 표시한다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1/tasks/103');
  await page.getByRole('tab', { name: '산출물', exact: true }).click();
  const buttons = page.getByRole('button', { name: '새로고침', exact: true });
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) await assertIconButton(button);
});

test('평가 결과 새로고침은 전용 결과 탭에서 제공한다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'manager'));
  await page.goto('/preview/spaces/1/rounds');
  await page.evaluate(async () => {
    const { resetMockState } = await import('/src/mock/planned.js');
    const { previewContext } = await import('/src/mock/preview.js');
    resetMockState(previewContext(), 'review');
  });
  await page.reload();
  await page.getByRole('tab', { name: '동료 평가 결과', exact: true }).click();
  await assertIconButton(page.getByRole('button', { name: '평가 결과 새로고침', exact: true }));
  await expect(page.getByRole('button', { name: /새로고침/, exact: false })).toHaveCount(1);
});

test('공통 새로고침은 키보드와 비활성화를 지원하고 폼을 제출하지 않는다', async ({
  page,
}) => {
  await page.goto('/preview/main');
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import(
      '/node_modules/.vite/deps/react-dom_client.js'
    );
    const { default: RefreshButton } = await import(
      '/src/components/RefreshButton.jsx'
    );
    const container = document.createElement('form');
    container.style.cssText = 'position:fixed;top:120px;left:50%;z-index:1000;background:white';
    document.body.append(container);
    const state = { clicks: 0, submits: 0 };
    container.addEventListener('submit', (event) => {
      event.preventDefault();
      state.submits += 1;
    });
    const root = ReactDOM.createRoot(container);
    window.refreshButtonTest = {
      state,
      render: (disabled) =>
        root.render(
          React.createElement(RefreshButton, {
            label: '테스트 새로고침',
            disabled,
            onClick: () => {
              state.clicks += 1;
            },
          }),
        ),
    };
    window.refreshButtonTest.render(false);
  });
  const button = page.getByRole('button', {
    name: '테스트 새로고침',
    exact: true,
  });
  await assertIconButton(button);
  await button.click();
  await button.press('Enter');
  await button.press('Space');
  expect(await page.evaluate(() => window.refreshButtonTest.state)).toEqual({
    clicks: 3,
    submits: 0,
  });
  await page.evaluate(() => window.refreshButtonTest.render(true));
  await expect(button).toBeDisabled();
  await button.evaluate((element) => element.click());
  expect(await page.evaluate(() => window.refreshButtonTest.state)).toEqual({
    clicks: 3,
    submits: 0,
  });
});
