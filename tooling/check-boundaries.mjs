import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rules = new Map([
  ['packages/achievements', new Set()],
  ['packages/backup', new Set(['@grounded/local-store'])],
  ['packages/domain', new Set()],
  ['packages/application', new Set(['@grounded/domain'])],
  ['packages/config', new Set()],
  ['packages/settings', new Set()],
  ['packages/ui', new Set(['@grounded/domain'])],
  ['packages/auth', new Set()],
  ['packages/weight', new Set(['@grounded/application', '@grounded/domain'])],
  ['packages/nutrition', new Set(['@grounded/application', '@grounded/domain'])],
  ['packages/exercise', new Set(['@grounded/application', '@grounded/domain'])],
  ['packages/habits', new Set(['@grounded/application', '@grounded/domain'])],
  ['packages/sharing', new Set(['@grounded/application', '@grounded/domain'])],
  ['packages/notifications', new Set(['@grounded/domain'])],
  ['packages/reports', new Set()],
  [
    'packages/habits-local',
    new Set([
      '@grounded/application',
      '@grounded/domain',
      '@grounded/habits',
      '@grounded/local-store',
    ]),
  ],
  [
    'packages/exercise-local',
    new Set([
      '@grounded/application',
      '@grounded/domain',
      '@grounded/exercise',
      '@grounded/local-store',
    ]),
  ],
  [
    'packages/nutrition-local',
    new Set([
      '@grounded/application',
      '@grounded/domain',
      '@grounded/local-store',
      '@grounded/nutrition',
    ]),
  ],
  [
    'packages/weight-local',
    new Set([
      '@grounded/application',
      '@grounded/domain',
      '@grounded/local-store',
      '@grounded/weight',
    ]),
  ],
  [
    'packages/supabase',
    new Set([
      '@grounded/auth',
      '@grounded/domain',
      '@grounded/exercise',
      '@grounded/habits',
      '@grounded/local-store',
      '@grounded/nutrition',
      '@grounded/sharing',
      '@grounded/sync',
      '@grounded/weight',
    ]),
  ],
  ['packages/local-store', new Set(['@grounded/application', '@grounded/domain'])],
  [
    'packages/sync',
    new Set(['@grounded/application', '@grounded/domain', '@grounded/local-store']),
  ],
]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
    }),
  );
  return nested.flat();
}

const violations = [];
for (const [packagePath, allowed] of rules) {
  const directory = join(root, packagePath, 'src');
  const files = await sourceFiles(directory);
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const imports = source.matchAll(/(?:from\s+|import\s*)['"](@grounded\/[^'"]+)['"]/g);
    for (const match of imports) {
      const dependency = match[1];
      if (dependency && !allowed.has(dependency)) {
        violations.push(`${relative(root, file)} cannot import ${dependency}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Architecture boundaries passed.');
}
