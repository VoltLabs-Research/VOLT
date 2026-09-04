import fs from 'node:fs/promises';
import path from 'node:path';
import {
    listProjectFiles,
    normalizeProjectRelativePath
} from '@modules/plugin/services/binaries/zip-project-extractor';


interface ResolvedEntrypoint {
    entrypointPath: string;
    projectRootDir: string;
}

const WINDOWS_EXECUTABLE_EXTENSIONS = ['.exe', '.cmd', '.bat'];

const entrypointCandidates = (normalizedEntrypoint: string): string[] => {
    if (process.platform !== 'win32' || path.posix.extname(normalizedEntrypoint)) {
        return [normalizedEntrypoint];
    }

    return [
        normalizedEntrypoint,
        ...WINDOWS_EXECUTABLE_EXTENSIONS.map((extension) => `${normalizedEntrypoint}${extension}`)
    ];
};

const fileExists = (filePath: string): Promise<boolean> =>
    fs.access(filePath, fs.constants.F_OK).then(() => true, () => false);

const resolveRelativePath = async (
    projectDir: string,
    entrypointScript: string,
    kind: string
): Promise<string> => {
    const normalizedEntrypoint = normalizeProjectRelativePath(entrypointScript);
    if (!normalizedEntrypoint) {
        throw new Error(`${kind} entrypointScript is empty`);
    }

    const candidates = entrypointCandidates(normalizedEntrypoint);
    for (const candidate of candidates) {
        if (await fileExists(path.join(projectDir, candidate))) {
            return candidate;
        }
    }

    const projectFiles = (await listProjectFiles(projectDir))
        .map((filePath) => normalizeProjectRelativePath(filePath))
        .sort((left, right) => left.length - right.length);
    const suffixMatches = projectFiles.filter((filePath) => candidates.some((candidate) => {
        return filePath === candidate || filePath.endsWith(`/${candidate}`);
    }));

    if (suffixMatches.length === 1) {
        return suffixMatches[0];
    }

    const availableEntriesPreview = projectFiles.slice(0, 12).join(', ');
    throw new Error(
        `${kind} entrypoint "${entrypointScript}" was not found after extracting the project archive`
        + (availableEntriesPreview ? `; sample extracted files: ${availableEntriesPreview}` : '')
    );
};

export const resolvePythonEntrypoint = async (
    projectDir: string,
    entrypointScript: string
): Promise<ResolvedEntrypoint> => {
    const resolvedRelativePath = await resolveRelativePath(projectDir, entrypointScript, 'Python');
    const normalizedEntrypoint = normalizeProjectRelativePath(entrypointScript);
    const rootPrefix = resolvedRelativePath === normalizedEntrypoint
        ? ''
        : resolvedRelativePath.slice(0, resolvedRelativePath.length - normalizedEntrypoint.length).replace(/\/$/, '');

    return {
        entrypointPath: path.join(projectDir, resolvedRelativePath),
        projectRootDir: rootPrefix ? path.join(projectDir, rootPrefix) : projectDir
    };
};

export const resolvePackagedEntrypoint = async (
    projectDir: string,
    entrypointScript: string
): Promise<ResolvedEntrypoint> => {
    const resolvedRelativePath = await resolveRelativePath(projectDir, entrypointScript, 'Packaged executable');
    const entrypointPath = path.join(projectDir, resolvedRelativePath);

    return {
        entrypointPath,
        projectRootDir: path.dirname(entrypointPath)
    };
};
