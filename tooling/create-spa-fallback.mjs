import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const distribution = join(process.cwd(), 'dist');
await copyFile(join(distribution, 'index.html'), join(distribution, '404.html'));
console.log('Created the static-host SPA fallback.');
