import { test, expect } from '@playwright/test';

const activeSlide = (page) => page.locator('.showcase-slide.is-active');
async function freezeClock(page) {
  await page.clock.install({ time: new Date('2026-10-18T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-18T12:00:01Z'));
}

test('예시 창은 맥 창 색상과 작업 상태·파일 종류별 색상을 유지한다', async ({
  page,
}) => {
  await page.goto('/');
  const dots = page.locator('.showcase-window-dots i');
  await expect(dots.nth(0)).toHaveCSS('background-color', 'rgb(255, 95, 87)');
  await expect(dots.nth(1)).toHaveCSS('background-color', 'rgb(254, 188, 46)');
  await expect(dots.nth(2)).toHaveCSS('background-color', 'rgb(40, 200, 64)');
  const colors = await page
    .locator('.showcase-column-heading')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).color),
    );
  expect(new Set(colors).size).toBe(4);
  await page.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(page.locator('[data-file-type="pdf"] svg').first()).toHaveCSS(
    'color',
    'rgb(209, 92, 88)',
  );
  await expect(page.locator('[data-file-type="design"] svg')).toHaveCSS(
    'color',
    'rgb(133, 100, 182)',
  );
});

test('소개 메인은 서버 요청 없이 열리고 기존 로그인 화면으로 연결된다', async ({
  page,
}) => {
  const apiCalls = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      apiCalls.push(request.url());
  });
  await page.route('**/api/**', (route) =>
    new URL(route.request().url()).pathname.startsWith('/api/')
      ? route.abort()
      : route.continue(),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '함께 만드는 프로젝트,',
  );
  await expect(
    page.getByRole('heading', { name: '내 스페이스', exact: true }),
  ).toHaveCount(0);
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '1 / 3 · 작업보드',
  );
  expect(apiCalls).toEqual([]);
  await page.unroute('**/api/**');
  await page.route('**/api/me', (route) =>
    route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
  );
  await page
    .getByRole('link', { name: 'Fairplay 시작하기', exact: true })
    .click();
  await expect(page).toHaveURL('/login');
  await expect(
    page.getByRole('button', { name: 'Google로 계속하기' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '← Fairplay 소개로' }).click();
  await expect(page).toHaveURL('/');
});

test('예시는 자동 전환 없이 탭을 선택할 때만 페이드 전환된다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await freezeClock(page);
  await page.goto('/');
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '1 / 3 · 작업보드',
  );
  await page.clock.fastForward(15000);
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '1 / 3 · 작업보드',
  );
  await expect(page.getByText('5초마다 자동 전환')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /예시 자동 전환/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '2 / 3 · 산출물',
  );
  await expect(activeSlide(page)).toHaveCSS(
    'transition-duration',
    '0.65s, 0.65s',
  );
  await page
    .getByRole('button', { name: '기여도 리포트', exact: true })
    .click();
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '3 / 3 · 기여도 리포트',
  );
  await expect(
    page.getByRole('button', { name: '기여도 리포트', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('모션 감소 설정에서는 자동 전환 없이 수동 선택을 제공한다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await freezeClock(page);
  await page.goto('/');
  await page.clock.fastForward(15000);
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '1 / 3 · 작업보드',
  );
  await page.getByRole('button', { name: '산출물', exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '2 / 3 · 산출물',
  );
  await expect(activeSlide(page)).toHaveCSS('transition-duration', '0s');
});

test('Google 인증 성공 후 소개 화면이 아닌 스페이스 목록으로 이동한다', async ({
  page,
}) => {
  let authenticated = false;
  const calls = [];
  await page.addInitScript(() => {
    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: ({ callback }) => ({
            requestCode: () => callback({ code: 'test-code' }),
          }),
        },
      },
    };
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    calls.push({ path, body: request.postDataJSON() });
    if (path === '/api/me')
      return route.fulfill({
        status: authenticated ? 200 : 401,
        json: authenticated
          ? { id: 'test-user', name: '박선우' }
          : { code: 'UNAUTHORIZED' },
      });
    if (path === '/api/auth/csrf')
      return route.fulfill({
        json: { headerName: 'X-CSRF-TOKEN', token: 'test-token' },
      });
    if (path === '/api/auth/google') {
      authenticated = true;
      return route.fulfill({ json: { id: 'test-user', name: '박선우' } });
    }
    if (path === '/api/spaces') return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
  });
  await page.goto('/');
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await expect(page).toHaveURL('/main');
  await expect(
    page.getByRole('heading', { name: '내 스페이스', exact: true }),
  ).toBeVisible();
  expect(calls.find((call) => call.path === '/api/auth/google').body).toEqual({
    code: 'test-code',
  });
  await page.goto('/login');
  await expect(page).toHaveURL('/main');
});

for (const width of [375, 768, 1440]) {
  test(`${width}px 화면에서 예시 패널과 소개 페이지가 가로로 잘리지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const spacing = await page.locator('.showcase-tabs').evaluate((element) => {
      const tabs = element.getBoundingClientRect();
      return {
        above:
          tabs.top -
          document.querySelector('.landing-hero').getBoundingClientRect()
            .bottom,
        below:
          document.querySelector('.showcase-window').getBoundingClientRect()
            .top - tabs.bottom,
      };
    });
    expect(spacing.above).toBe(width <= 600 ? 24 : 32);
    expect(spacing.below).toBe(spacing.above);
    for (const title of ['작업보드', '산출물', '기여도 리포트']) {
      await page.getByRole('button', { name: title, exact: true }).click();
      await expect(activeSlide(page)).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(
        await activeSlide(page).evaluate(
          (element) => element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
    }
  });
}

for (const width of [1440, 1920]) {
  test(`${width}px 데스크톱 예시 창은 16:9 모니터 비율이다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto('/');
    const window = page.locator('.showcase-window');
    await expect(window).toBeVisible();
    const bounds = await window.boundingBox();
    expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
    await page.getByRole('button', { name: '산출물', exact: true }).click();
    expect((await window.boundingBox()).height).toBe(bounds.height);
  });
}
