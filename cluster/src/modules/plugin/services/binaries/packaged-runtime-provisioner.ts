import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginExecutionRuntime } from '@shared/contracts/types/plugin-execution';
import { sharedLibraryPathEnv } from '@shared/infrastructure/utilities/process-path';
import { ensureExtractedProject } from '@modules/plugin/services/binaries/zip-project-extractor';
import { resolvePackagedEntrypoint } from '@modules/plugin/services/binaries/extracted-entrypoint-resolver';
import { runtimeDirectoryFor } from '@modules/plugin/services/binaries/runtime-cache-keys';


const PACKAGED_PROJECT_DIRECTORY = 'packaged-project';
const PACKAGED_ZIP_EXTRACTED_MARKER = '.packaged-zip-extracted';
const PACKAGED_LIBRARY_DIRECTORY = 'lib';

export const providePackagedRuntime = async (input: {
    runtimeKey: string;
    artifactPath: string;
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
    if (process.platform !== 'win32') {
        await fs.chmod(resolvedEntrypoint.entrypointPath, 0o755).catch(() => {});
    }

    return {
        commandPath: resolvedEntrypoint.entrypointPath,
        argsPrefix: [],
        env: sharedLibraryPathEnv([
            path.join(projectDir, PACKAGED_LIBRARY_DIRECTORY),
            resolvedEntrypoint.projectRootDir
        ]),
        projectPath: projectDir
    };
};
