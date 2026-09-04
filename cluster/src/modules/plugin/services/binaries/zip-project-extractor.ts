import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Open as UnzipperOpen } from 'unzipper';
import fg from 'fast-glob';
import { mapLimited } from '@shared/application/utilities/map-limited';


export const normalizeProjectRelativePath = (value: string): string => {
    return path.posix.normalize(value.replace(/\\/g, '/'))
        .replace(/^(\.\/)+/, '')
        .replace(/^\/+/, '');
};

export const listProjectFiles = (projectDir: string): Promise<string[]> => {
    return fg('**/*', {
        cwd: projectDir,
        onlyFiles: true,
        dot: true,
        unique: true,
        ignore: [
            '__MACOSX',
            '**/__MACOSX/**'
        ]
    });
};

const extractZip = async (zipPath: string, destinationDir: string): Promise<void> => {
    const directory = await UnzipperOpen.file(zipPath);
    const files = directory.files;
    await mapLimited(files, 8, (entry) => (async () => {
        const normalized = normalizeProjectRelativePath(entry.path);
        if (!normalized || normalized.startsWith('__MACOSX')) {
            return;
        }

        const targetPath = path.join(destinationDir, normalized);
        const relativeToDest = path.relative(destinationDir, targetPath);
        if (relativeToDest.startsWith('..') || path.isAbsolute(relativeToDest)) {
            return;
        }

        if (entry.type === 'Directory') {
            await fs.mkdir(targetPath, { recursive: true });
            return;
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await pipeline(entry.stream(), createWriteStream(targetPath));
    })());
};

export const ensureExtractedProject = async (input: {
    archivePath: string;
    projectDir: string;
    markerPath: string;
    markerValue: string;
}): Promise<void> => {
    const currentMarker = await fs.readFile(input.markerPath, 'utf-8').catch(() => null);
    if (currentMarker === input.markerValue) {
        return;
    }

    await fs.rm(input.projectDir, {
        recursive: true,
        force: true
    });
    await fs.mkdir(input.projectDir, { recursive: true });
    await extractZip(input.archivePath, input.projectDir);
    await fs.writeFile(input.markerPath, input.markerValue, 'utf-8');
};
