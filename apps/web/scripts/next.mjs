import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const mode = process.argv[2];
if (!['dev', 'build', 'start'].includes(mode)) {
  throw new Error('Expected dev, build, or start.');
}

let rootEnv = {};
try {
  rootEnv = parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

// Only public settings from the root .env are passed to the frontend.
const childEnv = { ...process.env };
for (const [key, value] of Object.entries(rootEnv)) {
  if (key.startsWith('NEXT_PUBLIC_') && childEnv[key] === undefined) {
    childEnv[key] = value;
  }
}

const args = [mode];
if (mode !== 'build') {
  const configuredPort = process.env.FRONTEND_PORT ?? rootEnv.FRONTEND_PORT ?? '3000';
  const port = Number(configuredPort);
  if (!/^\d+$/.test(configuredPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FRONTEND_PORT must be an integer between 1 and 65535.');
  }
  args.push('--port', String(port));
}
args.push(...process.argv.slice(3));

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), ...args], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: childEnv,
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
