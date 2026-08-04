import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const assetsDirectory = join(process.cwd(), 'dist', 'assets');
const maximumChunkBytes = 350 * 1024;
const files = await readdir(assetsDirectory);
const javascript = files.filter((file) => file.endsWith('.js'));
const oversized = [];

for (const file of javascript) {
  const path = join(assetsDirectory, file);
  const details = await stat(path);
  if (details.size > maximumChunkBytes) {
    oversized.push(`${relative(process.cwd(), path)} (${(details.size / 1024).toFixed(1)} kB)`);
  }
}

if (oversized.length > 0) {
  console.error(
    `Web bundle budget exceeded (maximum 350 kB per JavaScript chunk):\n${oversized.join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Web bundle budget passed: ${javascript.length} JavaScript chunks, each at or below 350 kB.`,
  );
}
