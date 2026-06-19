import getPort from 'get-port';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const port = await getPort({ port: 8000 });

const result = spawnSync(
    createRequire(import.meta.url).resolve('@playwright/test/cli'),
    ['test'],
    {
        stdio: 'inherit',
        env: { ...process.env, E2E_PORT: String(port) },
    },
);

process.exit(result.status ?? 1);
