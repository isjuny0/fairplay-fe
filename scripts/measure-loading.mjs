import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const [origin, outputPath = '/tmp/fairplay-loading.json'] = process.argv.slice(2);
if (!origin) throw new Error('사용법: node scripts/measure-loading.mjs <origin> <output.json>');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const routes = ['/', '/login', '/preview/spaces/1/teams/1/tasks'];
const results = [];
try {
  for (const route of routes) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send('Network.enable');
      await session.send('Network.setCacheDisabled', { cacheDisabled: true });
      await session.send('Network.emulateNetworkConditions', {
        offline: false, latency: 50, downloadThroughput: 10_000_000 / 8,
        uploadThroughput: 5_000_000 / 8,
      });
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      await page.addInitScript(() => {
        window.loadingMetrics = { lcp: null, longTaskMs: 0 };
        new PerformanceObserver(list => {
          window.loadingMetrics.lcp = list.getEntries().at(-1)?.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.loadingMetrics.longTaskMs += entry.duration;
        }).observe({ type: 'longtask', buffered: true });
      });
      const response = await page.goto(new URL(route, origin).href, { waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor();
      await page.locator('.loading-placeholder').waitFor({ state: 'hidden' });
      const automationReadyMs = await page.evaluate(() => performance.now());
      await page.evaluate(() => document.fonts.ready);
      // Capture late LCP candidates after the visible screen and its fonts settle.
      await page.waitForTimeout(1500);
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        const scripts = resources.filter(resource => new URL(resource.name).pathname.endsWith('.js'));
        return {
          ttfbMs: navigation.responseStart - navigation.requestStart,
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
          ...window.loadingMetrics,
          scripts: scripts.map(resource => ({
            url: resource.name, encodedBytes: resource.encodedBodySize,
            decodedBytes: resource.decodedBodySize, transferBytes: resource.transferSize,
          })),
          scriptEncodedBytes: scripts.reduce((sum, resource) => sum + resource.encodedBodySize, 0),
          scriptDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
          totalTransferBytes: navigation.transferSize + resources.reduce((sum, resource) => sum + resource.transferSize, 0),
        };
      });
      results.push({ route, run, status: response.status(), automationReadyMs, ...metrics, errors: failures });
      console.log(`${route} ${run}/3: ready=${Math.round(automationReadyMs)}ms JS=${Math.round(metrics.scriptEncodedBytes / 1000)}kB`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const median = values => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
const summary = routes.map(route => {
  const samples = results.filter(result => result.route === route);
  return { route, ...Object.fromEntries(
    ['ttfbMs', 'domContentLoadedMs', 'fcpMs', 'lcp', 'longTaskMs', 'scriptEncodedBytes', 'scriptDecodedBytes', 'totalTransferBytes']
      .map(key => [key, median(samples.map(sample => sample[key]))]),
  ) };
});
const report = {
  measuredAt: new Date().toISOString(), origin,
  conditions: { viewport: '1440x1000', runs: 3, cache: 'disabled, new context per run', cpuSlowdown: 4, downloadMbps: 10, uploadMbps: 5, latencyMs: 50 },
  summary, results,
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
