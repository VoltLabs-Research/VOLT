import fg from 'fast-glob';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

export const autoImportDecoratedFiles = async (): Promise<void> => {
    const extension = path.extname(__filename);
    const files = await fg(`**/*${extension}`, {
        cwd: SRC_ROOT,
        absolute: true,
        ignore: [
            '**/*.d.ts',
            '**/*.test.*',
            '**/*.spec.*',
            'app/bootstrap/**',
            `index${extension}`
        ]
    });

    await Promise.all(files.map((file) => import(file)));
};
