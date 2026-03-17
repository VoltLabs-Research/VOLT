import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { MinioService } from '@/modules/platform/services';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { EntrypointType } from '@/shared/contracts';

const PLUGINS_BUCKET = 'volt-plugins';
const PYTHON_VENV_DIRECTORY = 'venv';
const PYTHON_REQUIREMENTS_FILENAME = 'requirements.txt';
const PYTHON_INSTALL_MARKER_FILENAME = '.requirements-installed';
const PYTHON_PROJECT_DIRECTORY = 'project';
const PYTHON_ZIP_EXTRACTED_MARKER = '.zip-extracted';

const buildCacheKey = (binaryObjectPath: string): string => {
    const basename = path.basename(binaryObjectPath);
    const digest = createHash('sha256').update(binaryObjectPath).digest('hex');
    return `${digest}-${basename}`;
};

const buildPythonRuntimeKey = (binaryObjectPath: string, requirementsFile: string): string => {
    return createHash('sha256')
        .update(binaryObjectPath)
        .update('\u0000')
        .update(requirementsFile)
        .digest('hex');
};

const writeStreamToFile = async (stream: Readable, filePath: string): Promise<void> => {
    await pipeline(stream, createWriteStream(filePath));
};

export interface PluginBinaryCacheService {
    getExecutionRuntime(input: {
        binaryObjectPath: string;
        entrypointType?: EntrypointType;
        requirementsFile?: string;
        entrypointScript?: string;
    }): Promise<{
        artifactPath: string;
        commandPath: string;
        argsPrefix: string[];
        env?: NodeJS.ProcessEnv;
    }>;
};

const writeFileIfChanged = async (filePath: string, content: string): Promise<void> => {
    const currentContent = await fs.readFile(filePath, 'utf-8').catch(() => null);
    if (currentContent === content) {
        return;
    }

    await fs.writeFile(filePath, content, 'utf-8');
};

const runCommand = (commandPath: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(commandPath, args, {
            cwd,
            env: { ...process.env, ...env },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const stderrChunks: Buffer[] = [];

        child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        child.on('error', (error) => reject(error));
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(Buffer.concat(stderrChunks).toString('utf-8') || `${commandPath} exited with code ${String(code)}`));
        });
    });
};

const binaryCachePromises = new Map<string, Promise<string>>();
const pythonRuntimePromises = new Map<string, Promise<{
    artifactPath: string;
    commandPath: string;
    argsPrefix: string[];
    env: NodeJS.ProcessEnv;
}>>();

export const createPluginBinaryCacheService = (minioService: MinioService): PluginBinaryCacheService => {
    const getBinaryPath = async (binaryObjectPath: string): Promise<string> => {
        const cacheKey = buildCacheKey(binaryObjectPath);
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, cacheKey);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            return localPath;
        } catch {
        }

        await fs.mkdir(DAEMON_PATHS.pluginBinCache, { recursive: true });

        const stream = await minioService.getObjectStream(PLUGINS_BUCKET, binaryObjectPath);
        await writeStreamToFile(stream, localPath);
        await fs.chmod(localPath, 0o755);

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    };

    const getCachedBinaryPath = async (binaryObjectPath: string): Promise<string> => {
        const cacheKey = buildCacheKey(binaryObjectPath);
        const existingPromise = binaryCachePromises.get(cacheKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = getBinaryPath(binaryObjectPath)
            .finally(() => {
                binaryCachePromises.delete(cacheKey);
            });

        binaryCachePromises.set(cacheKey, nextPromise);
        return nextPromise;
    };

    const getPythonRuntime = async (binaryObjectPath: string, requirementsFile: string, entrypointScript?: string) => {
        const artifactPath = await getCachedBinaryPath(binaryObjectPath);
        const runtimeKey = buildPythonRuntimeKey(binaryObjectPath, requirementsFile);
        const existingPromise = pythonRuntimePromises.get(runtimeKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = (async () => {
            const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKey);
            const venvPath = path.join(runtimeDirectory, PYTHON_VENV_DIRECTORY);
            const requirementsPath = path.join(runtimeDirectory, PYTHON_REQUIREMENTS_FILENAME);
            const installMarkerPath = path.join(runtimeDirectory, PYTHON_INSTALL_MARKER_FILENAME);
            const pythonPath = path.join(venvPath, 'bin', 'python3');

            await fs.mkdir(runtimeDirectory, { recursive: true });

            // When entrypointScript is provided, the artifact is a ZIP project.
            // Extract it before installing requirements so that local package
            // references (e.g. "." or "./mypackage") in requirements.txt resolve
            // correctly against the extracted project tree.
            let scriptPath = artifactPath;
            if (entrypointScript) {
                const projectDir = path.join(runtimeDirectory, PYTHON_PROJECT_DIRECTORY);
                const extractMarkerPath = path.join(runtimeDirectory, PYTHON_ZIP_EXTRACTED_MARKER);

                try {
                    await fs.access(extractMarkerPath, fs.constants.F_OK);
                } catch {
                    await fs.rm(projectDir, { recursive: true, force: true });
                    await fs.mkdir(projectDir, { recursive: true });
                    await runCommand('unzip', ['-o', artifactPath, '-d', projectDir], runtimeDirectory);
                    await fs.writeFile(extractMarkerPath, artifactPath, 'utf-8');
                    logger.info(`Python project extracted: ${artifactPath} -> ${projectDir}`);
                }

                scriptPath = path.join(projectDir, entrypointScript);
            }

            await writeFileIfChanged(requirementsPath, requirementsFile);

            try {
                await fs.access(pythonPath, fs.constants.X_OK);
            } catch {
                await runCommand('python3', ['-m', 'venv', venvPath], runtimeDirectory);
            }

            try {
                await fs.access(installMarkerPath, fs.constants.F_OK);
            } catch {
                await runCommand(pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], runtimeDirectory);
                await fs.writeFile(installMarkerPath, runtimeKey, 'utf-8');
            }

            const runtimeEnv: NodeJS.ProcessEnv = {
                VIRTUAL_ENV: venvPath,
                PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH ?? ''}`
            };

            if (entrypointScript) {
                runtimeEnv.PLUGIN_PROJECT_DIR = path.join(runtimeDirectory, PYTHON_PROJECT_DIRECTORY);
            }

            return {
                artifactPath,
                commandPath: pythonPath,
                argsPrefix: [scriptPath],
                env: runtimeEnv
            };
        })().finally(() => {
            pythonRuntimePromises.delete(runtimeKey);
        });

        pythonRuntimePromises.set(runtimeKey, nextPromise);
        return nextPromise;
    };

    return {
        async getExecutionRuntime(input) {
            const entrypointType = input.entrypointType ?? EntrypointType.Executable;
            if (entrypointType === EntrypointType.PythonScript) {
                return getPythonRuntime(input.binaryObjectPath, input.requirementsFile ?? '', input.entrypointScript);
            }

            const artifactPath = await getCachedBinaryPath(input.binaryObjectPath);
            return {
                artifactPath,
                commandPath: artifactPath,
                argsPrefix: []
            };
        }
    };
};
