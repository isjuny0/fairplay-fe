import { test, expect } from '@playwright/test';

for (const width of [1440, 768, 390, 320]) {
  test(`${width}px 팀 목록은 검색 가능한 열 형태이고 두 목록의 새로고침은 아이콘만 표시한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/preview/spaces/1');
    const own = page.getByRole('region', { name: '내 팀', exact: true });
    await expect(
      own.getByRole('button', { name: '삼위일체 팀 홈으로 이동', exact: true }),
    ).toBeVisible();
    const list = page.getByRole('list', { name: '팀 목록', exact: true });
    await expect(
      list.getByRole('heading', { name: '파도', exact: true }),
    ).toBeVisible();
    const refresh = page.getByRole('button', {
      name: '팀 목록 새로고침',
      exact: true,
    });
    await expect(refresh).toHaveText('');
    const search = page.getByRole('searchbox', {
      name: '팀 이름 검색',
      exact: true,
    });
    const heading = page.getByRole('heading', {
      name: '팀 목록 1',
      exact: true,
    });
    await expect(heading).toHaveText('팀 목록 1');
    const headingBox = await heading.boundingBox(),
      searchBox = await search.boundingBox();
    expect(
      Math.abs(
        headingBox.y +
          headingBox.height / 2 -
          (searchBox.y + searchBox.height / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(searchBox.x).toBeGreaterThan(headingBox.x + headingBox.width);
    const refreshBox = await refresh.boundingBox();
    expect(refreshBox.x - searchBox.x - searchBox.width).toBeGreaterThanOrEqual(
      0,
    );
    expect(refreshBox.x - searchBox.x - searchBox.width).toBeLessThanOrEqual(
      13,
    );
    await search.fill('없는 팀');
    await expect(list).toContainText('검색한 팀이 없습니다.');
    await search.fill('파도');
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(
      list.getByRole('button', { name: '파도 가입 신청', exact: true }),
    ).toBeDisabled();
    expect(
      await list.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    const headerSnapshot = () =>
      page.evaluate(() =>
        Object.fromEntries(
          [
            '.space-page-header',
            '.space-page-header h1',
            '.space-page-eyebrow',
          ].map((selector) => {
            const el = document.querySelector(selector),
              box = el.getBoundingClientRect(),
              style = getComputedStyle(el);
            return [
              selector,
              {
                x: box.x,
                y: box.y + scrollY,
                width: box.width,
                height: box.height,
                font: style.fontSize,
                weight: style.fontWeight,
              },
            ];
          }),
        ),
      );
    const spaceHeader = await headerSnapshot();
    await page.goto('/preview/main');
    await expect(
      page.getByRole('heading', { name: '내 스페이스', exact: true }),
    ).toBeVisible();
    const myHeader = await headerSnapshot();
    for (const selector of Object.keys(spaceHeader)) {
      expect(myHeader[selector].font).toBe(spaceHeader[selector].font);
      expect(myHeader[selector].weight).toBe(spaceHeader[selector].weight);
    }
    for (const key of ['x', 'width'])
      expect(Math.abs(myHeader['.space-page-header'][key] - spaceHeader['.space-page-header'][key])).toBeLessThanOrEqual(1);
    expect(myHeader['.space-page-header'].height).toBeLessThan(spaceHeader['.space-page-header'].height);
    const toolbarBox = await page.locator('.directory-toolbar').boundingBox();
    const headerBox = await page.locator('.space-page-header').boundingBox();
    expect(toolbarBox.y - headerBox.y - headerBox.height).toBeLessThanOrEqual(24);
    const myRefresh = page
      .getByRole('main')
      .getByRole('button', { name: '새로고침', exact: true });
    await expect(myRefresh).toHaveText('');
    await expect(myRefresh.locator('svg')).toHaveCount(1);
    await myRefresh.click();
    await expect(page.locator('.space-list li')).toHaveCount(1);
  });
}
