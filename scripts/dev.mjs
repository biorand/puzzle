import { spawn } from 'child_process';
import getPort from 'get-port';

const port = await getPort({ port: 8080 });

const esbuild = spawn(
    'npx', ['esbuild', 'src/main.ts', '--bundle', '--outfile=dist/app.min.js', '--sourcemap', '--watch=forever'],
    { stdio: 'inherit' },
);

// Wait for esbuild to complete its first build before starting the server
await new Promise((resolve) => setTimeout(resolve, 1500));

const server = spawn(
    'npx', ['http-server', '.', '-p', String(port), '-c-1'],
    { stdio: 'inherit' },
);

console.log(`\n  http://localhost:${port}\n`);

const cleanup = () => {
    esbuild.kill();
    server.kill();
    process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
server.on('close', cleanup);
