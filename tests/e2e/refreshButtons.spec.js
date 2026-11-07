import { test, expect } from '@playwright/test';

const screens = [
  ['/main', '내 스페이스', '새로고침'],
  ['/spaces/1/teams/1', '삼위일체', '현황 새로고침'],
  ['/spaces/1/teams/1/tasks/103', 'AI 피드백 화면 개선', '새로고침'],
  ['/spaces/1/teams/1/members', '팀원 관리', '새로고침'],
  ['/spaces/1/teams/1/settings', '팀 설정', '현황 새로고침'],
  ['/spaces/1/teams/1/peer-evaluations', '동료 평가', '평가 상태 새로고침'],
  ['/spaces/1/teams/1/mid-feedback', '중간 피드백', '피드백 새로고침'],
  ['/spaces/1/teams/1/reports', '기여도 리포트', '리포트 새로고침'],
  [
    '/spaces/1/reports',
    '리포트 관리',
    '리포트 관리 새로고침',
    'manager',
  ],
  ['/spaces/1/settings#join-code', '스페이스 관리', '코드 새로고침', 'manager'],
];

async function assertIconButton(button, size) {
  await expect(button).toBeVisible();
  await expect(button).toHaveText('');
  await expect(button).toHaveAttribute('type', 'button');
  const label = await button.getAttribute('aria-label');
  expect(label).toContain('새로고침');
  await expect(button).toHaveAttribute('title', label);
  await expect(button.locator('svg')).toHaveCount(1);
  await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  const box = await button.boundingBox();
  size ??= await button.evaluate(() => innerWidth <= 720 ? 44 : 40);
  expect(box.width).toBe(size);
  expect(box.height).toBe(size);
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
          .locator('.rag-page').getByRole('button', { name: '팀 자료', exact: true })
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

test('작업 상세는 결과물 새로고침을 숨기고 댓글 새로고침을 표시한다', async ({
  page,
}) => {
  await page.goto('/preview/spaces/1/teams/1/tasks/103');
  await page.getByRole('tab', { name: '결과물', exact: true }).click();
  const deliverables = page.locator('#task-deliverables-section');
  await expect(deliverables.getByRole('heading', { name: '연결된 결과물' })).toBeVisible();
  await expect(deliverables.getByRole('button', { name: '새로고침', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: '작업 내용', exact: true }).click();
  await assertIconButton(page.locator('#task-comments-section').getByRole('button', { name: '새로고침', exact: true }));
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
  await expect(page.getByRole('main').getByRole('heading', { level: 1 }).first()).toBeFocused();
  await page.evaluate(async () => {
    // Reuse the application's Vite module URLs so this fixture does not load a second React renderer.
    const dependencyUrl = (name) => performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === `/node_modules/.vite/deps/${name}.js`);
    const { default: React } = await import(dependencyUrl('react'));
    const { default: ReactDOM } = await import(dependencyUrl('react-dom_client'));
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
