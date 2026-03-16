import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const sourcePath = join(__dirname, '../src/core/docs/openapi.yaml');
const targetPath = join(__dirname, '../dist/core/docs/openapi.yaml');

if (!existsSync(sourcePath)) {
    throw new Error(`OpenAPI bundle not found at ${sourcePath}`);
}

mkdirSync(dirname(targetPath), { recursive: true });
copyFileSync(sourcePath, targetPath);
