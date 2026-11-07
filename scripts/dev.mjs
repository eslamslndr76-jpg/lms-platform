#!/usr/bin/env node
/**
 * Local development runner — starts the three pillars with fixed ports:
 *
 *   backend   → http://localhost:3001
 *   user-ui   → http://localhost:3000
 *   admin-ui  → http://localhost:3002
 *
 * Usage: npm run dev            (all three)
 *        npm run dev:backend    (one pillar)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const isWin = process.platform === 'win32';

const RESET = '\x1b[0m';
const services = [
  { name: 'backend', color: '\x1b[36m', port: 3001, workspace: 'backend' },
  { name: 'user-ui', color: '\x1b[32m', port: 3000, workspace: 'user-ui' },
  { name: 'admin-ui', color: '\x1b[35m', port: 3002, workspace: 'admin-ui' },
];

const children = [];
let shuttingDown = false;

function log(service, line) {
  const label = `${service.color}[${service.name.padEnd(8)}]${RESET}`;
  process.stdout.write(`${label} ${line}\n`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.killed || child.exitCode !== null) continue;
    if (isWin) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 500);
}

function start(service) {
  const child = spawn(`npm run dev -w ${service.workspace}`, {
    cwd: root,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);

  const pipe = (stream) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) log(service, line);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    log(service, `exited with code ${code}`);
    if (code !== 0) shutdown(code ?? 1);
  });

  log(service, `starting on http://localhost:${service.port}`);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('\n  وحدة التدريب و التطوير — بيئة التطوير المحلية\n');
for (const service of services) start(service);
console.log('\n  API:       http://localhost:3001/api/health');
console.log('  Student:   http://localhost:3000');
console.log('  Admin:     http://localhost:3002\n');
