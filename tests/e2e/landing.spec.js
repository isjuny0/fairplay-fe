import { test, expect } from '@playwright/test';

const activeSlide = (page) => page.locator('.showcase-slide.is-active');
async function freezeClock(page) {
  await page.clock.install({ time: new Date('2026-10-18T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-18T12:00:01Z'));
}

test('기능 소개는 가상 UI 대신 실제 서비스 캡처를 표시한다', async ({
  page,
}) => {
  await freezeClock(page);
  await page.goto('/');
  const dots = page.locator('.showcase-window-dots i');
  await expect(dots.nth(0)).toHaveCSS('background-color', 'rgb(255, 95, 87)');
  await expect(dots.nth(1)).toHaveCSS('background-color', 'rgb(254, 188, 46)');
  await expect(dots.nth(2)).toHaveCSS('background-color', 'rgb(40, 200, 64)');
  await expect(page.locator('.showcase-board, .showcase-sidebar, .showcase-chart')).toHaveCount(0);
  await expect(page.locator('.showcase-example-badge')).toHaveText('실제 서비스 화면');
  await expect(page.locator('.showcase-slide img')).toHaveCount(3);
  await expect.poll(() => page.locator('.showcase-slide img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth === 2880 && image.naturalHeight === 1620))).toBe(true);
  await expect(activeSlide(page).getByRole('img')).toHaveAttribute('src', /\/landing\/tasks-desktop\.jpg\?v=.+/);
  await page.getByRole('button', { name: '팀 자료', exact: true }).click();
  await expect(activeSlide(page).getByRole('img')).toHaveAttribute('src', /\/landing\/materials-desktop\.jpg\?v=.+/);
  await page.getByRole('button', { name: '기여도 리포트', exact: true }).click();
  await expect(activeSlide(page).getByRole('img')).toHaveAttribute('src', /\/landing\/report-desktop\.jpg\?v=.+/);
  const revisions = await page.locator('.landing-page img[src*="/landing/"], .landing-page source[srcset*="/landing/"]').evaluateAll((elements) =>
    elements.map((element) => new URL(element.getAttribute('src') || element.getAttribute('srcset'), location.href).searchParams.get('v')));
  expect(revisions.every(Boolean)).toBe(true);
  expect(new Set(revisions).size).toBe(1);
});

test('수업·동아리의 여러 팀 운영과 팀 협업을 밝은 색감으로 소개한다', async ({ page }) => {
  await freezeClock(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('여러 팀의 활동을 한 공간에서함께한 기여까지 선명하게.');
  await expect(page.locator('.landing-hero-description')).toContainText('수업·동아리·프로젝트 프로그램');
  await expect(page.locator('.landing-use-case-grid h3')).toHaveText(['수업과 캡스톤디자인', '동아리와 학회', '스터디와 프로젝트 모임']);
  const accents = ['rgb(0, 168, 107)', 'rgb(37, 99, 235)', 'rgb(250, 204, 21)'];
  for (const [index, color] of accents.entries()) {
    const card = page.locator('.landing-use-case-grid article').nth(index);
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('border-top-width', '1px');
    await expect(card).toHaveCSS('border-top-color', color);
    await expect(card.locator('.landing-use-case-icon')).toHaveCSS('color', color);
    await expect(card.locator('.landing-use-case-icon')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  const structure = page.getByRole('figure', { name: '하나의 스페이스 안에 여러 팀이 있는 구조 예시' });
  await expect(structure.locator('.landing-team-node strong')).toHaveText(['A팀', 'B팀', 'C팀']);
  await expect(page.locator('.landing-role-list dt')).toHaveText(['관리자', '팀 리더·팀원']);
  await expect(page.locator('#manager-title')).toHaveText('팀이 많아져도진행 상황을 놓치지 않도록.');
  await expect(page.locator('.landing-manager-copy li')).toHaveText(['전체 공지사항과 참여자·팀 구성 관리', '팀별 작업 진행 상황과 등록 자료 확인', '동료 평가 일정과 팀별 제출 현황 관리']);
  const managerImage = page.locator('.landing-manager-screen img');
  await managerImage.scrollIntoViewIfNeeded();
  await expect.poll(() => managerImage.evaluate((image) => image.complete && image.naturalWidth === 2880)).toBe(true);
  await expect(page.locator('.landing-workflow-grid h3')).toHaveText(['무엇을 맡고 어디까지 했는지 명확하게.', '결과물과 그 과정을 함께 남기세요.', '함께한 노력을 기억이 아닌 기록으로.']);
  await expect(page.locator('.landing-workflow-grid p').last()).toContainText('숫자 하나로 단정하는 대신');
  await expect(page.locator('.landing-workflow-grid p').nth(1)).toContainText('AI 피드백');
  await expect(page.locator('.landing-bottom-cta h2')).toHaveText('여러 팀의 시작부터함께한 과정의 마무리까지.');
  await expect(page.locator('.landing-bottom-cta')).not.toContainText('관리자에게는 전체를 보는 시야를');
  await expect(page.locator('.landing-cta-tagline')).toHaveCount(0);
  await expect(page.locator('.landing-bottom-cta')).toHaveCSS('background-color', 'rgb(2, 106, 82)');
  await expect(page.locator('.landing-bottom-cta')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('.landing-bottom-cta .landing-button')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.landing-header').getByRole('link', { name: '시작하기', exact: true })).toHaveCount(0);
  await expect(page.locator('.landing-header').getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  await expect(page.locator('.landing-space-node')).toHaveCSS('background-color', 'rgb(8, 124, 85)');
  await expect(page.locator('.landing-space-node')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('.landing-space-node span')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('.landing-process, .landing-principle, .showcase-intro, .showcase-story')).toHaveCount(0);
  await expect(page.locator('.landing-hero-art')).toHaveCount(0);
  await expect(page.locator('.landing-workflow-grid article').first()).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.landing-hero .landing-eyebrow')).toHaveCSS('padding', '0px');
  await expect(page.locator('.landing-feature-preview')).toHaveCount(0);
  await expect(page.locator('.landing-feature-visual img')).toHaveCount(3);
  await expect(page.locator('.landing-hero-visual')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.landing-footer')).not.toContainText('팀의 과정에 기록을, 기여에 근거를.');
  await expect(page.locator('.landing-footer .brand-logo')).toBeVisible();
  await expect(page.locator('.hero-visual-backdrop > .hero-visual-board')).toHaveCount(1);
  await expect(page.locator('.hero-visual-backdrop')).toHaveCSS('border-top-width', '1px');
  await expect(page.locator('.hero-visual-backdrop')).toHaveCSS('transform', 'none');
  await expect(page.getByRole('button', { name: '미리보기 설정', exact: true })).toHaveCount(0);
});

test('소개용 캡처를 정리해도 실제 서비스의 미리보기 버튼은 유지한다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fairplay:preview-role', 'leader'));
  await page.goto('/preview/spaces/1/teams/1/tasks');
  await expect(page.getByRole('heading', { name: '작업', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '미리보기 설정', exact: true })).toBeVisible();
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
    '여러 팀의 활동을 한 공간에서',
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

test('실제 기능 화면은 정확히 3초 간격으로 전환하고 처음으로 순환한다', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await freezeClock(page);
  await page.goto('/');
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '1 / 3 · 작업보드',
  );
  await page.clock.runFor(2999);
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '1 / 3 · 작업보드',
  );
  await page.clock.runFor(1);
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '2 / 3 · 팀 자료',
  );
  await expect(activeSlide(page)).toHaveCSS(
    'transition-duration',
    '0.65s, 0.65s',
  );
  await page.clock.runFor(3000);
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '3 / 3 · 기여도 리포트',
  );
  await expect(
    page.getByRole('button', { name: '기여도 리포트', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(3000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '1 / 3 · 작업보드');
  await expect(page.locator('.showcase-screen')).toHaveAttribute('aria-live', 'off');
});

test('자동 전환은 마우스·키보드로 살펴보는 동안 멈추고 영역을 벗어나면 재개한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await freezeClock(page);
  await page.goto('/');
  await page.locator('#features').hover();
  await page.clock.runFor(9000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '1 / 3 · 작업보드');
  await page.mouse.move(0, 0);
  await page.clock.runFor(3000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '2 / 3 · 팀 자료');
  await page.getByRole('button', { name: '팀 자료', exact: true }).focus();
  await page.clock.runFor(9000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '2 / 3 · 팀 자료');
  await page.getByRole('link', { name: 'Fairplay 시작하기', exact: true }).focus();
  await page.clock.runFor(3000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '3 / 3 · 기여도 리포트');
});

test('일시정지·재생과 탭·이전·다음 수동 선택을 지원한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await freezeClock(page);
  await page.goto('/');
  await page.getByRole('button', { name: '화면 자동 전환 일시정지', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(9000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '1 / 3 · 작업보드');
  await page.getByRole('button', { name: '이전 기능 화면', exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '3 / 3 · 기여도 리포트');
  await page.getByRole('button', { name: '다음 기능 화면', exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '1 / 3 · 작업보드');
  await page.getByRole('button', { name: '팀 자료', exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '2 / 3 · 팀 자료');
  await page.getByRole('button', { name: '화면 자동 전환 재생', exact: true }).click();
  await page.locator('.landing-header').hover();
  await page.clock.runFor(3000);
  await expect(activeSlide(page)).toHaveAttribute('aria-label', '3 / 3 · 기여도 리포트');
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
  await page.getByRole('button', { name: '팀 자료', exact: true }).click();
  await expect(activeSlide(page)).toHaveAttribute(
    'aria-label',
    '2 / 3 · 팀 자료',
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

for (const width of [320, 375, 768, 1280, 1440]) {
  test(`${width}px 화면에서 예시 패널과 소개 페이지가 가로로 잘리지 않는다`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await freezeClock(page);
    await page.goto('/');
    const spacing = await page.locator('.showcase-tabs').evaluate((element) => {
      const tabs = element.getBoundingClientRect();
      return {
        above:
          tabs.top -
          document.querySelector('.showcase-controls').getBoundingClientRect()
            .top,
        below:
          document.querySelector('.showcase-window').getBoundingClientRect()
            .top - tabs.bottom,
      };
    });
    expect(spacing.above).toBe(width <= 600 ? 24 : 32);
    expect(spacing.below).toBe(spacing.above);
    let firstWindowY;
    for (const title of ['작업보드', '팀 자료', '기여도 리포트']) {
      await page.getByRole('button', { name: title, exact: true }).click();
      await expect(activeSlide(page)).toBeVisible();
      const image = activeSlide(page).getByRole('img');
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
      expect(await image.evaluate((element) => element.currentSrc)).toContain(width <= 600 ? '-mobile.jpg' : '-desktop.jpg');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const y = await page.locator('.showcase-window').evaluate((element) => element.getBoundingClientRect().top + scrollY);
      if (firstWindowY === undefined) firstWindowY = y;
      expect(y).toBe(firstWindowY);
      await page.locator('#features').screenshot({ path: testInfo.outputPath(`actual-screen-${title}.png`), animations: 'disabled' });
      expect(
        await activeSlide(page).evaluate(
          (element) => element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
    }
    await page.locator('.landing-hero').screenshot({ path: testInfo.outputPath('landing-introduction.png'), animations: 'disabled' });
    await expect(page.locator('.hero-visual-backdrop')).toHaveCSS('transform', 'none');
    await expect(page.locator('.hero-visual-board')).not.toHaveCSS('transform', 'none');
    for (const [selector, name] of [['.landing-use-cases', 'use-cases'], ['.landing-space-section', 'space-structure'], ['.landing-manager', 'manager']]) {
      const section = page.locator(selector);
      await expect(section).toBeVisible();
      expect(await section.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await section.screenshot({ path: testInfo.outputPath(`landing-${name}.png`), animations: 'disabled' });
    }
    await page.locator('.landing-workflow').screenshot({ path: testInfo.outputPath('landing-benefits.png'), animations: 'disabled' });
    for (const meta of await page.locator('.landing-feature-meta').all()) {
      const number = await meta.locator('small').boundingBox();
      const icon = await meta.locator('.landing-feature-icon').boundingBox();
      expect(icon.x - number.x - number.width).toBeCloseTo(20, 1);
      expect(Math.abs(icon.y + icon.height / 2 - number.y - number.height / 2)).toBeLessThan(1);
    }
    await expect(page.locator('.landing-use-cases')).toHaveCSS('margin-top', `${width <= 600 ? 80 : width <= 800 ? 96 : 128}px`);
    await expect(page.locator('.landing-workflow-grid')).toHaveCSS('row-gap', `${width <= 600 ? 64 : width <= 800 ? 84 : 112}px`);
    const cta = page.locator('.landing-bottom-cta');
    expect(await cta.locator('h2').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(20);
    await expect(cta.locator('p').first()).toHaveCSS('font-size', '11px');
    await cta.screenshot({ path: testInfo.outputPath('landing-start-card.png'), animations: 'disabled' });
    const layout = await page.evaluate(() => {
      const hero = document.querySelector('.landing-hero-inner');
      const cta = document.querySelector('.landing-bottom-cta');
      const workflow = document.querySelector('.landing-workflow');
      return {
        heroWidth: hero.getBoundingClientRect().width,
        headlineSize: parseFloat(getComputedStyle(hero.querySelector('h1')).fontSize),
        ctaHeight: cta.getBoundingClientRect().height,
        ctaGap: cta.getBoundingClientRect().top - workflow.getBoundingClientRect().bottom,
      };
    });
    if (width >= 1280) {
      expect(layout.heroWidth).toBeLessThanOrEqual(1200);
      expect(layout.headlineSize).toBeLessThanOrEqual(42);
      expect(layout.ctaHeight).toBeLessThan(220);
      expect(layout.ctaGap).toBe(224);
    }
    expect(layout.ctaGap).toBe(width <= 600 ? 160 : width <= 800 ? 184 : 224);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: testInfo.outputPath('landing-full-page.png'), fullPage: true, animations: 'disabled' });
  });
}

test('소개 문구는 불필요한 쉼표를 줄이고 의미 단위의 줄바꿈을 유지한다', async ({ page }) => {
  await page.goto('/');
  const description = page.locator('.landing-space-copy > p').last();
  expect(await description.textContent()).toBe('수업이나 동아리를 하나의 ‘스페이스’로 구성하고\n그 안에서 여러 팀이 각자의 프로젝트를 진행합니다.');
  for (const heading of await page.locator('.landing-page h1, .landing-page h2, .landing-page h3').all()) {
    expect(await heading.textContent()).not.toMatch(/(?:에서|까지|부터|해도|져도|맡고|노력을),/);
  }
  await expect(page.locator('.landing-workflow-grid p').first()).toContainText('작업별 담당자와 일정,');
  await expect(page.locator('.landing-space-shared')).toHaveText('전체 공지와 운영은 함께, 협업은 팀별로.');
  await expect(description).toHaveCSS('white-space', 'pre-line');
  for (const selector of ['.landing-use-case-grid p', '.landing-workflow-grid p', '.landing-manager-copy > p:not(.landing-eyebrow)', '.landing-role-list dd']) {
    for (const element of await page.locator(selector).all()) {
      expect(await element.textContent()).toContain('\n');
      await expect(element).toHaveCSS('white-space', 'pre-line');
    }
  }
});

for (const width of [1440, 1920]) {
  test(`${width}px 데스크톱 실제 화면은 16:9 비율이며 전환해도 높이가 유지된다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto('/');
    const window = page.locator('.showcase-screen');
    await expect(window).toBeVisible();
    const bounds = await window.boundingBox();
    expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
    await page.getByRole('button', { name: '팀 자료', exact: true }).click();
    expect((await window.boundingBox()).height).toBe(bounds.height);
  });
}
