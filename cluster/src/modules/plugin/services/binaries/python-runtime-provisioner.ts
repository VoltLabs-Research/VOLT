import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginExecutionRuntime } from '@shared/contracts/types/plugin-execution';
import { runCommand } from '@modules/plugin/services/binaries/run-command';
import { ensureExtractedProject } from '@modules/plugin/services/binaries/zip-project-extractor';
import { resolvePythonEntrypoint } from '@modules/plugin/services/binaries/extracted-entrypoint-resolver';
import { runtimeDirectoryFor } from '@modules/plugin/services/binaries/runtime-cache-keys';


export const PYTHON_VENV_DIRECTORY = 'venv';
export const PYTHON_PROJECT_DIRECTORY = 'project';
const PYTHON_REQUIREMENTS_FILENAME = 'requirements.txt';
const PYTHON_INSTALL_MARKER_FILENAME = '.requirements-installed';
const PYTHON_ZIP_EXTRACTED_MARKER = '.zip-extracted';
const PYTHON_PROJECT_REQUIREMENTS_FILENAME = '.volt-requirements.txt';
const STUB_MSGPACK_REQUIREMENT = 'msgpack';

export const PYTHON_RUNTIME_WARM_ENTRIES = [
    PYTHON_VENV_DIRECTORY,
    PYTHON_PROJECT_DIRECTORY,
    PYTHON_REQUIREMENTS_FILENAME,
    PYTHON_INSTALL_MARKER_FILENAME,
    PYTHON_ZIP_EXTRACTED_MARKER
];

const pathExists = (target: string, mode: number): Promise<boolean> =>
    fs.access(target, mode).then(() => true, () => false);

const withStubRequirements = (requirementsFile: string): string => {
    const lines = requirementsFile.split(/\r?\n/);
    if (lines.some((line) => /^\s*msgpack\b/i.test(line))) {
        return requirementsFile;
    }
    const normalized = requirementsFile.endsWith('\n') || requirementsFile === ''
        ? requirementsFile
        : `${requirementsFile}\n`;
    return `${normalized}${STUB_MSGPACK_REQUIREMENT}\n`;
};

export const providePythonRuntime = async (input: {
    runtimeKey: string;
    artifactPath: string;
    artifactRevision: string;
    requirementsFile: string;
    entrypointScript?: string;
}): Promise<Omit<PluginExecutionRuntime, 'artifactPath' | 'binaryHash'>> => {
    const runtimeDirectory = runtimeDirectoryFor(input.runtimeKey);
    const venvPath = path.join(runtimeDirectory, PYTHON_VENV_DIRECTORY);
    const installMarkerPath = path.join(runtimeDirectory, PYTHON_INSTALL_MARKER_FILENAME);
    const pythonPath = path.join(venvPath, 'bin', 'python3');

    await fs.mkdir(runtimeDirectory, { recursive: true });

    let scriptPath = input.artifactPath;
    let projectRootDir = runtimeDirectory;
    if (input.entrypointScript) {
        const projectDir = path.join(runtimeDirectory, PYTHON_PROJECT_DIRECTORY);
        await ensureExtractedProject({
            archivePath: input.artifactPath,
            projectDir,
            markerPath: path.join(runtimeDirectory, PYTHON_ZIP_EXTRACTED_MARKER),
            markerValue: input.artifactRevision
        });

        const resolvedEntrypoint = await resolvePythonEntrypoint(projectDir, input.entrypointScript);
        scriptPath = resolvedEntrypoint.entrypointPath;
        projectRootDir = resolvedEntrypoint.projectRootDir;
    }

    const requirementsPath = input.entrypointScript
        ? path.join(projectRootDir, PYTHON_PROJECT_REQUIREMENTS_FILENAME)
        : path.join(runtimeDirectory, PYTHON_REQUIREMENTS_FILENAME);
    const requirements = withStubRequirements(input.requirementsFile);
    const currentRequirements = await fs.readFile(requirementsPath, 'utf-8').catch(() => null);
    if (currentRequirements !== requirements) {
        await fs.writeFile(requirementsPath, requirements, 'utf-8');
    }

    if (!await pathExists(pythonPath, fs.constants.X_OK)) {
        await runCommand('python3', ['-m', 'venv', venvPath], runtimeDirectory);
    }

    if (!await pathExists(installMarkerPath, fs.constants.F_OK)) {
        await runCommand(pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], projectRootDir);
        await fs.writeFile(installMarkerPath, input.runtimeKey, 'utf-8');
    }

    const env: NodeJS.ProcessEnv = {
        VIRTUAL_ENV: venvPath,
        PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH}`
    };
    if (input.entrypointScript) {
        env.PLUGIN_PROJECT_DIR = projectRootDir;
    }

    return {
        commandPath: pythonPath,
        argsPrefix: [scriptPath],
        env,
        projectPath: input.entrypointScript ? projectRootDir : undefined
    };
};
