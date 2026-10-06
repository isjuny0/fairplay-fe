import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'VITE_API_BASE_URL= VITE_GOOGLE_CLIENT_ID=test-client-id npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
});
