import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const expoHome = resolve(process.cwd(), '.expo-user');
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, ['exec', 'expo', ...process.argv.slice(2)], {
  env: {
    ...process.env,
    __UNSAFE_EXPO_HOME_DIRECTORY: expoHome,
    EXPO_NO_TELEMETRY: '1',
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
