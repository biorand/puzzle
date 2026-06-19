import { defineConfig } from '@playwright/test';

const port = parseInt(process.env.E2E_PORT || '8000', 10);

export default defineConfig({
    testDir: './e2e',
    timeout: 15000,
    retries: 0,
    use: {
        baseURL: `http://localhost:${port}`,
        headless: true,
    },
    webServer: {
        command: `npx http-server . -p ${port} -c-1`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        timeout: 10000,
    },
});
