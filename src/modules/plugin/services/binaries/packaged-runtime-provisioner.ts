import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginExecutionRuntime } from '@shared/contracts/types/plugin-execution';
import { ensureExtractedProject } from '@modules/plugin/services/binaries/zip-project-extractor';
import { resolvePackagedEntrypoint } from '@modules/plugin/services/binaries/extracted-entrypoint-resolver';
import { runtimeDirectoryFor } from '@modules/plugin/services/binaries/runtime-cache-keys';

/** Provisions a packaged executable plugin: extracted project plus its bundled library path. */

const PACKAGED_PROJECT_DIRECTORY = 'packaged-project';
const PACKAGED_ZIP_EXTRACTED_MARKER = '.packaged-zip-extracted';

export const providePackagedRuntime = async (input: {
    runtimeKey: string;
    artifactPath: string;
    /** Identity of the artifact revision the extracted project must match. */
    artifactRevision: string;
    entrypointScript: string;
}): Promise<Omit<PluginExecutionRuntime, 'artifactPath' | 'binaryHash'>> => {
    const runtimeDirectory = runtimeDirectoryFor(input.runtimeKey);
    const projectDir = path.join(runtimeDirectory, PACKAGED_PROJECT_DIRECTORY);

    await fs.mkdir(runtimeDirectory, { recursive: true });
    await ensureExtractedProject({
        archivePath: input.artifactPath,
        projectDir,
        markerPath: path.join(runtimeDirectory, PACKAGED_ZIP_EXTRACTED_MARKER),
        markerValue: input.artifactRevision
    });

    const resolvedEntrypoint = await resolvePackagedEntrypoint(projectDir, input.entrypointScript);
    await fs.chmod(resolvedEntrypoint.entrypointPath, 0o755).catch(() => {});

    const libraryPath = path.join(projectDir, 'lib');
    const existingLibraryPath = process.env.LD_LIBRARY_PATH;

    return {
        commandPath: resolvedEntrypoint.entrypointPath,
        argsPrefix: [],
        env: {
            LD_LIBRARY_PATH: existingLibraryPath
                ? `${libraryPath}:${existingLibraryPath}`
                : libraryPath
        },
        projectPath: projectDir
    };
};
