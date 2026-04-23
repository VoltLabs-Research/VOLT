import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import logger from '@shared/infrastructure/logger';

/**
 * Roots (relative to `src/`) whose class files must be imported for their
 * class-level decorators (`@Singleton`, `@Subscribe`, ...) to fire and attach
 * themselves to the tsyringe container / the pending-subscriptions list.
 *
 * Kept broad on purpose — controller factories, use cases, repositories,
 * services, socket modules and event handlers all live under these roots.
 */
const SCAN_ROOTS: readonly string[] = [
    'shared',
    'modules'
];

const EXCLUDED_BASENAMES = new Set<string>([
    'index.ts',
    'index.js'
]);

const EXCLUDED_SEGMENTS = new Set<string>([
    'domain',
    'dtos',
    'validation',
    'constants',
    'presenters'
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

/**
 * Imports every class-carrying source file under `src/{shared,modules}` so
 * that every `@Singleton`, `@Transient`, `@AliasOf`, `@CollectionMember` and
 * `@Subscribe` decorator runs and self-registers. Replaces the 22 hand-written
 * module manifests and the 18 subscriber manifests.
 */
export const autoloadModules = async (): Promise<void> => {
    const srcDir = resolve(__dirname, '..', '..', '..');
    const started = Date.now();
    let imported = 0;

    for (const root of SCAN_ROOTS) {
        const absoluteRoot = join(srcDir, root);
        if (!isDirectory(absoluteRoot)) {
            continue;
        }

        for (const file of collectFiles(absoluteRoot)) {
            await import(file);
            imported += 1;
        }
    }

    logger.info(`@autoload: imported ${imported} module files in ${Date.now() - started}ms`);
};
