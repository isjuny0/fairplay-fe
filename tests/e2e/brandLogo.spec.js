import { test, expect } from '@playwright/test';

const placements = [
  { path: '/preview/main', selector: '.topbar-brand .brand-logo', label: '헤더' },
  { path: '/preview/login', selector: '.login-brand .brand-logo', label: '로그인' },
  { path: '/', selector: '.landing-brand .brand-logo', label: '랜딩' },
];

for (const width of [1440, 390, 320]) {
  for (const placement of placements) {
    test(`수정한 공통 로고를 ${placement.label} 위치에 표시한다 (${width}px)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(placement.path);
      const logo = page.locator(placement.selector).first();
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute('src', '/branding/fairplay-logo.webp');
      await expect(logo).toHaveAttribute('width', '1060');
      await expect(logo).toHaveAttribute('height', '255');
      await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth === 1060 && img.naturalHeight === 255)).toBe(true);
      const box = await logo.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.width / box.height).toBeCloseTo(1060 / 255, 1);
      await logo.screenshot({ path: testInfo.outputPath('brand-logo.png') });
    });
  }
}

test('투명 배경에서 작은 심볼과 넓어진 글씨 간격을 유지한다', async ({ page }) => {
  await page.goto('/preview/main');
  const logo = page.locator('.topbar-brand .brand-logo');
  await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  const metrics = await logo.evaluate((img) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const bounds = [];
    for (let x = 0; x < canvas.width; x++) {
      let top = canvas.height, bottom = -1;
      for (let y = 0; y < canvas.height; y++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 64) {
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      bounds.push({ top, bottom });
    }
    const symbolLeft = bounds.findIndex((column) => column.bottom >= 0);
    let symbolRight = symbolLeft;
    while (symbolRight + 1 < bounds.length && bounds[symbolRight + 1].bottom >= 0) symbolRight++;
    let wordLeft = symbolRight + 1;
    while (wordLeft < bounds.length && bounds[wordLeft].bottom < 0) wordLeft++;
    const height = (items) => Math.max(...items.map((column) => column.bottom)) - Math.min(...items.filter((column) => column.bottom >= 0).map((column) => column.top)) + 1;
    return {
      alpha: pixels[3],
      gapRatio: (wordLeft - symbolRight - 1) / canvas.width,
      symbolHeight: height(bounds.slice(symbolLeft, symbolRight + 1)),
      wordHeight: height(bounds.slice(wordLeft)),
    };
  });
  expect(metrics.alpha).toBe(0);
  expect(metrics.gapRatio).toBeGreaterThan(0.06);
  expect(metrics.gapRatio).toBeLessThan(0.14);
  expect(metrics.symbolHeight).toBeLessThan(metrics.wordHeight * 1.05);
});
