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

const resolveRelativePath = async (
    projectDir: string,
    entrypointScript: string,
    kind: string
): Promise<string> => {
    const normalizedEntrypoint = normalizeProjectRelativePath(entrypointScript);
    if (!normalizedEntrypoint) {
        throw new Error(`${kind} entrypointScript is empty`);
    }

    const directPath = path.join(projectDir, normalizedEntrypoint);
    const directHit = await fs.access(directPath, fs.constants.F_OK).then(() => true, () => false);
    if (directHit) {
        return normalizedEntrypoint;
    }

    const projectFiles = (await listProjectFiles(projectDir))
        .map((filePath) => normalizeProjectRelativePath(filePath))
        .sort((left, right) => left.length - right.length);
    const suffixMatches = projectFiles.filter((filePath) => {
        return filePath === normalizedEntrypoint || filePath.endsWith(`/${normalizedEntrypoint}`);
    });

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
