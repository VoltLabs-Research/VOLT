import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import logger from '@shared/infrastructure/logger';
import { getEnabledModules } from '@core/bootstrap/module-state';

const SCAN_ROOTS: readonly string[] = [
    'shared',
    'modules'
];

const EXCLUDED_BASENAMES = new Set<string>([
    'index.ts',
    'index.js'
]);

const EXCLUDED_SEGMENTS = new Set<string>([
    'contracts',
    'domain',
    'models',
    'operations'
]);

const FILE_SUFFIXES: readonly string[] = ['.ts', '.js'];

const TEST_FILE_PATTERNS: readonly RegExp[] = [
    /\.test\.[cm]?[jt]s$/,
    /\.spec\.[cm]?[jt]s$/
];

const collectFiles = (rootAbsolute: string): string[] => {
    const entries = readdirSync(rootAbsolute, { withFileTypes: true, recursive: true }) as unknown as Array<{
        name: string;
        parentPath?: string;
        path?: string;
        isFile(): boolean;
    }>;

    const files: string[] = [];

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        if (EXCLUDED_BASENAMES.has(entry.name)) {
            continue;
        }

        if (!FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
            continue;
        }

        if (entry.name.endsWith('.d.ts')) {
            continue;
        }

        if (TEST_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))) {
            continue;
        }

        const parent = (entry.parentPath ?? entry.path ?? rootAbsolute);
        const fullPath = join(parent, entry.name);

        const segments = fullPath.slice(rootAbsolute.length).split(/[\\/]/);
        if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
            continue;
        }

        files.push(fullPath);
    }

    return files;
};

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
};

export const autoloadModules = async (): Promise<void> => {
    const srcDir = resolve(__dirname, '..', '..', '..');
    const started = Date.now();
    let imported = 0;

    const enabled = getEnabledModules();
    let skippedModules = 0;

    for (const root of SCAN_ROOTS) {
        const absoluteRoot = join(srcDir, root);
        if (!isDirectory(absoluteRoot)) {
            continue;
        }

        for (const file of collectFiles(absoluteRoot)) {
            if (root === 'modules') {
                const relative = file.slice(absoluteRoot.length).replace(/^[\\/]+/, '');
                const moduleKey = relative.split(/[\\/]/)[0];
                if (moduleKey && !enabled.has(moduleKey)) {
                    skippedModules += 1;
                    continue;
                }
            }

            await import(file);
            imported += 1;
        }
    }

    logger.info(`@autoload: imported ${imported} module files (skipped ${skippedModules} from disabled modules) in ${Date.now() - started}ms`);
};
