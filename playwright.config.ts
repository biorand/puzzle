import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 15000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
  },
  webServer: {
    command: 'npx http-server . -p 8000 -c-1',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
