import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { MinioService } from '@/modules/platform/services';
import { EntrypointType } from '@/shared/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

const PLUGINS_BUCKET = 'volt-plugins';
const PYTHON_VENV_DIRECTORY = 'venv';
const PYTHON_REQUIREMENTS_FILENAME = 'requirements.txt';
const PYTHON_INSTALL_MARKER_FILENAME = '.requirements-installed';
const PYTHON_PROJECT_DIRECTORY = 'project';
const PYTHON_ZIP_EXTRACTED_MARKER = '.zip-extracted';
const CACHE_LEASE_TTL_MS = 5 * 60 * 1000;
const CACHE_LEASE_POLL_MS = 200;

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

const delay = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const isAlreadyExistsError = (error: unknown): boolean => {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'EEXIST';
};

const getLeasePath = (targetPath: string): string => {
    return `${targetPath}.lock`;
};

const getTempPath = (targetPath: string): string => {
    return `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
};

const isExecutableFile = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
};

const isExistingFile = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

const isLeaseStale = async (leasePath: string): Promise<boolean> => {
    try {
        const stats = await fs.stat(leasePath);
        return (Date.now() - stats.mtimeMs) > CACHE_LEASE_TTL_MS;
    } catch {
        return false;
    }
};

const acquireLease = async (targetPath: string, readyCheck: () => Promise<boolean>): Promise<boolean> => {
    const leasePath = getLeasePath(targetPath);

    while (true) {
        if (await readyCheck()) {
            return false;
        }

        try {
            const handle = await fs.open(leasePath, 'wx');
            await handle.writeFile(String(Date.now()), 'utf-8');
            await handle.close();
            return true;
        } catch (error: unknown) {
            if (!isAlreadyExistsError(error)) {
                throw error;
            }

            if (await readyCheck()) {
                return false;
            }

            if (await isLeaseStale(leasePath)) {
                await fs.unlink(leasePath).catch(() => {});
                continue;
            }

            await delay(CACHE_LEASE_POLL_MS);
        }
    }
};

const releaseLease = async (targetPath: string): Promise<void> => {
    await fs.unlink(getLeasePath(targetPath)).catch(() => {});
};

const promoteTempFile = async (tempPath: string, targetPath: string): Promise<void> => {
    try {
        await fs.rename(tempPath, targetPath);
    } catch (error: unknown) {
        if (await isExistingFile(targetPath)) {
            await fs.unlink(tempPath).catch(() => {});
            return;
        }

        throw error;
    }
};

const writeFileAtomically = async (filePath: string, content: string): Promise<void> => {
    const tempPath = getTempPath(filePath);
    try {
        await fs.writeFile(tempPath, content, 'utf-8');
        await fs.rename(tempPath, filePath);
    } catch (error: unknown) {
        await fs.unlink(tempPath).catch(() => {});
        throw error;
    }
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

    await writeFileAtomically(filePath, content);
};

/** Cap stderr collection to prevent OOM from chatty subprocesses. */
const MAX_STDERR_BYTES = 10 * 1024 * 1024; // 10 MB — matches BinaryExecutorService

const runCommand = (commandPath: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(commandPath, args, {
            cwd,
            env: { ...process.env, ...env },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const stderrChunks: Buffer[] = [];
        let stderrBytes = 0;

        child.stderr.on('data', (chunk: Buffer) => {
            if (stderrBytes < MAX_STDERR_BYTES) {
                stderrChunks.push(chunk);
                stderrBytes += chunk.length;
            }
        });
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

        if (await isExecutableFile(localPath)) {
            return localPath;
        }

        await fs.mkdir(DAEMON_PATHS.pluginBinCache, { recursive: true });

        const acquiredLease = await acquireLease(localPath, async () => isExecutableFile(localPath));
        if (!acquiredLease) {
            return localPath;
        }

        let tempPath: string | null = null;

        try {
            if (await isExecutableFile(localPath)) {
                return localPath;
            }

            tempPath = getTempPath(localPath);

            const stream = await minioService.getObjectStream(PLUGINS_BUCKET, binaryObjectPath);
            await writeStreamToFile(stream, tempPath);
            await fs.chmod(tempPath, 0o755);
            await promoteTempFile(tempPath, localPath);
        } catch (error: unknown) {
            if (tempPath) {
                await fs.unlink(tempPath).catch(() => {});
            }

            throw error;
        } finally {
            await releaseLease(localPath);
        }

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
            const runtimeLockTarget = path.join(runtimeDirectory, '.runtime-ready');

            await fs.mkdir(runtimeDirectory, { recursive: true });

            const acquiredLease = await acquireLease(runtimeLockTarget, async () => false);

            try {
                // When entrypointScript is provided, the artifact is a ZIP project.
                // Extract it before installing requirements so that local package
                // references (e.g. "." or "./mypackage") in requirements.txt resolve
                // correctly against the extracted project tree.
                if (entrypointScript) {
                    const projectDir = path.join(runtimeDirectory, PYTHON_PROJECT_DIRECTORY);
                    const extractMarkerPath = path.join(runtimeDirectory, PYTHON_ZIP_EXTRACTED_MARKER);
                    const markerValue = await fs.readFile(extractMarkerPath, 'utf-8').catch(() => null);
                    const scriptPath = path.join(projectDir, entrypointScript);

                    if (markerValue !== artifactPath || !await isExistingFile(scriptPath)) {
                        const tempProjectDir = getTempPath(projectDir);
                        await fs.rm(tempProjectDir, { recursive: true, force: true });
                        await fs.mkdir(tempProjectDir, { recursive: true });
                        await runCommand('unzip', ['-o', artifactPath, '-d', tempProjectDir], runtimeDirectory);
                        await fs.rm(projectDir, { recursive: true, force: true });
                        await fs.rename(tempProjectDir, projectDir);
                        await writeFileAtomically(extractMarkerPath, artifactPath);
                        logger.info(`Python project extracted: ${artifactPath} -> ${projectDir}`);
                    }
                }

                await writeFileIfChanged(requirementsPath, requirementsFile);

                if (!await isExecutableFile(pythonPath)) {
                    await runCommand('python3', ['-m', 'venv', venvPath], runtimeDirectory);
                }

                const installMarkerValue = await fs.readFile(installMarkerPath, 'utf-8').catch(() => null);
                if (installMarkerValue !== runtimeKey) {
                    await runCommand(pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], runtimeDirectory);
                    await writeFileAtomically(installMarkerPath, runtimeKey);
                }
            } finally {
                if (acquiredLease) {
                    await releaseLease(runtimeLockTarget);
                }
            }

            let scriptPath = artifactPath;
            if (entrypointScript) {
                scriptPath = path.join(runtimeDirectory, PYTHON_PROJECT_DIRECTORY, entrypointScript);
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
