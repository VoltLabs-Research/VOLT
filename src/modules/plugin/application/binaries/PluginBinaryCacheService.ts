import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { EntrypointType, ObjectBucketName, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/contracts';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';

const PLUGINS_BUCKET = ObjectBucketName.Plugins;
const PYTHON_VENV_DIRECTORY = 'venv';
const PYTHON_REQUIREMENTS_FILENAME = 'requirements.txt';
const PYTHON_INSTALL_MARKER_FILENAME = '.requirements-installed';
const PYTHON_PROJECT_DIRECTORY = 'project';
const PYTHON_ZIP_EXTRACTED_MARKER = '.zip-extracted';
const PYTHON_PROJECT_REQUIREMENTS_FILENAME = '.volt-requirements.txt';
const PACKAGED_PROJECT_DIRECTORY = 'packaged-project';
const PACKAGED_ZIP_EXTRACTED_MARKER = '.packaged-zip-extracted';
const HASH_MARKER_FILENAME_SUFFIX = '.sha256';

const buildCacheKey = (binaryObjectPath: string, expectedHash?: string): string => {
    const basename = path.basename(binaryObjectPath);
    const digest = createHash('sha256')
        .update(binaryObjectPath)
        .update('\u0000')
        .update(expectedHash ?? '')
        .digest('hex');
    return `${digest}-${basename}`;
};

const buildPythonRuntimeKey = (binaryObjectPath: string, requirementsFile: string, expectedHash?: string): string => {
    return createHash('sha256')
        .update(binaryObjectPath)
        .update('\u0000')
        .update(expectedHash ?? '')
        .update('\u0000')
        .update(requirementsFile)
        .digest('hex');
};

const buildPackagedRuntimeKey = (
    binaryObjectPath: string,
    entrypointScript: string,
    expectedHash?: string
): string => {
    return createHash('sha256')
        .update(binaryObjectPath)
        .update('\u0000')
        .update(expectedHash ?? '')
        .update('\u0000')
        .update(entrypointScript)
        .digest('hex');
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
        projectPath?: string;
    }>;
};

const writeFileIfChanged = async (filePath: string, content: string): Promise<void> => {
    const currentContent = await fs.readFile(filePath, 'utf-8').catch(() => null);
    if (currentContent === content) {
        return;
    }

    await fs.writeFile(filePath, content, 'utf-8');
};

const MAX_STDERR_BYTES = 10 * 1024 * 1024;

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
    projectPath?: string;
}>>();
const packagedRuntimePromises = new Map<string, Promise<{
    artifactPath: string;
    commandPath: string;
    argsPrefix: string[];
    projectPath?: string;
}>>();

interface ResolvedPluginBinarySource {
    ownerClusterId: string;
    expectedHash?: string;
}

const readHashMarker = async (filePath: string): Promise<string | null> => {
    return fs.readFile(`${filePath}${HASH_MARKER_FILENAME_SUFFIX}`, 'utf-8')
        .then((value) => value.trim() || null)
        .catch(() => null);
};

const writeHashMarker = async (filePath: string, expectedHash?: string): Promise<void> => {
    if (!expectedHash) {
        await fs.rm(`${filePath}${HASH_MARKER_FILENAME_SUFFIX}`, { force: true }).catch(() => {});
        return;
    }

    await fs.writeFile(`${filePath}${HASH_MARKER_FILENAME_SUFFIX}`, expectedHash, 'utf-8');
};

const computeFileHash = async (filePath: string): Promise<string> => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
        hash.update(chunk);
    }

    return hash.digest('hex');
};

const normalizeProjectRelativePath = (value: string): string => {
    return path.posix.normalize(value.replace(/\\/g, '/'))
        .replace(/^(\.\/)+/, '')
        .replace(/^\/+/, '');
};

const collectProjectFiles = async (rootDir: string, relativeDir: string = ''): Promise<string[]> => {
    const directoryPath = relativeDir ? path.join(rootDir, relativeDir) : rootDir;
    const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];

    for (const entry of directoryEntries) {
        if (entry.name === '__MACOSX') {
            continue;
        }

        const relativePath = relativeDir
            ? path.posix.join(relativeDir, entry.name)
            : entry.name;

        if (entry.isDirectory()) {
            files.push(...await collectProjectFiles(rootDir, relativePath));
            continue;
        }

        if (entry.isFile()) {
            files.push(relativePath);
        }
    }

    return files;
};

const resolveExtractedPythonEntrypoint = async (
    projectDir: string,
    entrypointScript: string
): Promise<{ scriptPath: string; projectRootDir: string; resolvedRelativePath: string; }> => {
    const normalizedEntrypoint = normalizeProjectRelativePath(entrypointScript);

    if (!normalizedEntrypoint) {
        throw new Error('Python entrypointScript is empty');
    }

    const directScriptPath = path.join(projectDir, normalizedEntrypoint);
    try {
        await fs.access(directScriptPath, fs.constants.F_OK);
        return {
            scriptPath: directScriptPath,
            projectRootDir: projectDir,
            resolvedRelativePath: normalizedEntrypoint
        };
    } catch {
    }

    const projectFiles = (await collectProjectFiles(projectDir))
        .map((filePath) => normalizeProjectRelativePath(filePath))
        .sort((left, right) => left.length - right.length);

    const suffixMatches = projectFiles.filter((filePath) => {
        return filePath === normalizedEntrypoint || filePath.endsWith(`/${normalizedEntrypoint}`);
    });

    if (suffixMatches.length === 1) {
        const resolvedRelativePath = suffixMatches[0];
        const rootPrefix = resolvedRelativePath === normalizedEntrypoint
            ? ''
            : resolvedRelativePath.slice(0, resolvedRelativePath.length - normalizedEntrypoint.length).replace(/\/$/, '');

        return {
            scriptPath: path.join(projectDir, resolvedRelativePath),
            projectRootDir: rootPrefix ? path.join(projectDir, rootPrefix) : projectDir,
            resolvedRelativePath
        };
    }

    const availableEntriesPreview = projectFiles.slice(0, 12).join(', ');
    throw new Error(
        `Python entrypoint "${entrypointScript}" was not found after extracting the project archive`
        + (availableEntriesPreview ? `; sample extracted files: ${availableEntriesPreview}` : '')
    );
};

const resolveExtractedPackagedEntrypoint = async (
    projectDir: string,
    entrypointScript: string
): Promise<{ commandPath: string; projectRootDir: string; resolvedRelativePath: string; }> => {
    const normalizedEntrypoint = normalizeProjectRelativePath(entrypointScript);

    const directCommandPath = path.join(projectDir, normalizedEntrypoint);
    try {
        await fs.access(directCommandPath, fs.constants.F_OK);
        return {
            commandPath: directCommandPath,
            projectRootDir: path.dirname(directCommandPath),
            resolvedRelativePath: normalizedEntrypoint
        };
    } catch {
    }

    const projectFiles = (await collectProjectFiles(projectDir))
        .map((filePath) => normalizeProjectRelativePath(filePath))
        .sort((left, right) => left.length - right.length);
    const suffixMatches = projectFiles.filter((filePath) => {
        return filePath === normalizedEntrypoint
            || filePath.endsWith(`/${normalizedEntrypoint}`);
    });

    if (suffixMatches.length === 1) {
        const resolvedRelativePath = suffixMatches[0];
        const rootPrefix = resolvedRelativePath === normalizedEntrypoint
            ? path.dirname(resolvedRelativePath)
            : path.posix.dirname(resolvedRelativePath);

        return {
            commandPath: path.join(projectDir, resolvedRelativePath),
            projectRootDir: rootPrefix && rootPrefix !== '.'
                ? path.join(projectDir, rootPrefix)
                : projectDir,
            resolvedRelativePath
        };
    }

    const availableEntriesPreview = projectFiles.slice(0, 12).join(', ');
    throw new Error(
        `Packaged executable entrypoint "${entrypointScript}" was not found after extracting the project archive`
        + (availableEntriesPreview ? `; sample extracted files: ${availableEntriesPreview}` : '')
    );
};

export const createPluginBinaryCacheService = (objectStore: ClusterObjectStore): PluginBinaryCacheService => {
    const resolvePluginBinarySource = async (binaryObjectPath: string): Promise<ResolvedPluginBinarySource> => {
        const headResponse = await objectStore.head(
            VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            PLUGINS_BUCKET,
            binaryObjectPath
        );

        return {
            ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            expectedHash: headResponse.metadata.sha256
        };
    };

    const getBinaryPath = async (binaryObjectPath: string): Promise<string> => {
        const source = await resolvePluginBinarySource(binaryObjectPath);
        const cacheKey = buildCacheKey(binaryObjectPath, source.expectedHash);
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, cacheKey);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            const cachedHash = await readHashMarker(localPath);
            if (!source.expectedHash || cachedHash === source.expectedHash) {
                logger.info(
                    {
                        action: 'artifact.resolve.local-cache-hit',
                        binaryObjectPath,
                        cacheKey,
                        expectedHash: source.expectedHash
                    },
                    'Using cached plugin binary'
                );
                return localPath;
            }

            logger.warn(
                {
                    action: 'artifact.resolve.hash-mismatch',
                    binaryObjectPath,
                    cacheKey,
                    cachedHash,
                    expectedHash: source.expectedHash
                },
                'Plugin binary cache hash mismatch, refetching'
            );
            await fs.rm(localPath, { force: true }).catch(() => {});
            await fs.rm(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, { force: true }).catch(() => {});
        } catch {
        }

        await fs.mkdir(DAEMON_PATHS.pluginBinCache, { recursive: true });

        const response = await objectStore.getStream(source.ownerClusterId, PLUGINS_BUCKET, binaryObjectPath, {
            skipMetadata: true
        });
        await pipeline(response.stream, createWriteStream(localPath));
        if (source.expectedHash) {
            const computedHash = await computeFileHash(localPath);
            if (computedHash !== source.expectedHash) {
                logger.error(
                    {
                        action: 'artifact.resolve.hash-mismatch',
                        binaryObjectPath,
                        computedHash,
                        expectedHash: source.expectedHash
                    },
                    'Downloaded plugin binary hash does not match expected hash'
                );
                await fs.rm(localPath, { force: true }).catch(() => {});
                throw new Error(`Downloaded plugin binary hash mismatch for ${binaryObjectPath}`);
            }
        }

        await writeHashMarker(localPath, source.expectedHash);
        await fs.chmod(localPath, 0o755);

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    };

    const getCachedBinaryPath = async (binaryObjectPath: string): Promise<string> => {
        const source = await resolvePluginBinarySource(binaryObjectPath);
        const cacheKey = buildCacheKey(binaryObjectPath, source.expectedHash);
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
        const source = await resolvePluginBinarySource(binaryObjectPath);
        const artifactPath = await getCachedBinaryPath(binaryObjectPath);
        const runtimeKey = buildPythonRuntimeKey(binaryObjectPath, requirementsFile, source.expectedHash);
        const existingPromise = pythonRuntimePromises.get(runtimeKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = (async () => {
            const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKey);
            const venvPath = path.join(runtimeDirectory, PYTHON_VENV_DIRECTORY);
            const installMarkerPath = path.join(runtimeDirectory, PYTHON_INSTALL_MARKER_FILENAME);
            const pythonPath = path.join(venvPath, 'bin', 'python3');

            await fs.mkdir(runtimeDirectory, { recursive: true });

            let scriptPath = artifactPath;
            let projectRootDir = runtimeDirectory;
            if (entrypointScript) {
                const projectDir = path.join(runtimeDirectory, PYTHON_PROJECT_DIRECTORY);
                const extractMarkerPath = path.join(runtimeDirectory, PYTHON_ZIP_EXTRACTED_MARKER);
                const extractMarkerValue = source.expectedHash || artifactPath;

                try {
                    const currentMarker = await fs.readFile(extractMarkerPath, 'utf-8');
                    if (currentMarker.trim() !== extractMarkerValue) {
                        throw new Error('stale python project marker');
                    }
                } catch {
                    await fs.rm(projectDir, { recursive: true, force: true });
                    await fs.mkdir(projectDir, { recursive: true });
                    await runCommand('unzip', ['-o', artifactPath, '-d', projectDir], runtimeDirectory);
                    await fs.writeFile(extractMarkerPath, extractMarkerValue, 'utf-8');
                    logger.info(`Python project extracted: ${artifactPath} -> ${projectDir}`);
                }

                const resolvedEntrypoint = await resolveExtractedPythonEntrypoint(projectDir, entrypointScript);
                scriptPath = resolvedEntrypoint.scriptPath;
                projectRootDir = resolvedEntrypoint.projectRootDir;
                logger.info(
                    {
                        artifactPath,
                        entrypointScript,
                        projectRootDir,
                        resolvedRelativePath: resolvedEntrypoint.resolvedRelativePath,
                        scriptPath
                    },
                    'Resolved extracted Python plugin entrypoint'
                );
            }

            const requirementsPath = entrypointScript
                ? path.join(projectRootDir, PYTHON_PROJECT_REQUIREMENTS_FILENAME)
                : path.join(runtimeDirectory, PYTHON_REQUIREMENTS_FILENAME);
            await writeFileIfChanged(requirementsPath, requirementsFile);

            try {
                await fs.access(pythonPath, fs.constants.X_OK);
            } catch {
                await runCommand('python3', ['-m', 'venv', venvPath], runtimeDirectory);
            }

            try {
                await fs.access(installMarkerPath, fs.constants.F_OK);
            } catch {
                await runCommand(pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], projectRootDir);
                await fs.writeFile(installMarkerPath, runtimeKey, 'utf-8');
            }

            const runtimeEnv: NodeJS.ProcessEnv = {
                VIRTUAL_ENV: venvPath,
                PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH ?? ''}`
            };

            if (entrypointScript) {
                runtimeEnv.PLUGIN_PROJECT_DIR = projectRootDir;
            }

            return {
                artifactPath,
                commandPath: pythonPath,
                argsPrefix: [scriptPath],
                env: runtimeEnv,
                projectPath: entrypointScript ? projectRootDir : undefined
            };
        })().finally(() => {
            pythonRuntimePromises.delete(runtimeKey);
        });

        pythonRuntimePromises.set(runtimeKey, nextPromise);
        return nextPromise;
    };

    const getPackagedExecutableRuntime = async (
        binaryObjectPath: string,
        entrypointScript: string
    ) => {
        const source = await resolvePluginBinarySource(binaryObjectPath);
        const artifactPath = await getCachedBinaryPath(binaryObjectPath);
        const runtimeKey = buildPackagedRuntimeKey(binaryObjectPath, entrypointScript, source.expectedHash);
        const existingPromise = packagedRuntimePromises.get(runtimeKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = (async () => {
            const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKey);
            const projectDir = path.join(runtimeDirectory, PACKAGED_PROJECT_DIRECTORY);
            const extractMarkerPath = path.join(runtimeDirectory, PACKAGED_ZIP_EXTRACTED_MARKER);
            const extractMarkerValue = source.expectedHash || artifactPath;

            await fs.mkdir(runtimeDirectory, { recursive: true });

            try {
                const currentMarker = await fs.readFile(extractMarkerPath, 'utf-8');
                if (currentMarker.trim() !== extractMarkerValue) {
                    throw new Error('stale packaged project marker');
                }
            } catch {
                await fs.rm(projectDir, { recursive: true, force: true });
                await fs.mkdir(projectDir, { recursive: true });
                await runCommand('unzip', ['-o', artifactPath, '-d', projectDir], runtimeDirectory);
                await fs.writeFile(extractMarkerPath, extractMarkerValue, 'utf-8');
                logger.info(`Packaged executable project extracted: ${artifactPath} -> ${projectDir}`);
            }

            const resolvedEntrypoint = await resolveExtractedPackagedEntrypoint(projectDir, entrypointScript);
            await fs.chmod(resolvedEntrypoint.commandPath, 0o755).catch(() => {});
            logger.info(
                {
                    artifactPath,
                    entrypointScript,
                    projectRootDir: resolvedEntrypoint.projectRootDir,
                    resolvedRelativePath: resolvedEntrypoint.resolvedRelativePath,
                    commandPath: resolvedEntrypoint.commandPath
                },
                'Resolved extracted packaged plugin entrypoint'
            );

            return {
                artifactPath,
                commandPath: resolvedEntrypoint.commandPath,
                argsPrefix: [],
                projectPath: resolvedEntrypoint.projectRootDir
            };
        })().finally(() => {
            packagedRuntimePromises.delete(runtimeKey);
        });

        packagedRuntimePromises.set(runtimeKey, nextPromise);
        return nextPromise;
    };

    return {
        async getExecutionRuntime(input) {
            const entrypointType = input.entrypointType ?? EntrypointType.Executable;
            if (entrypointType === EntrypointType.PythonScript) {
                return getPythonRuntime(input.binaryObjectPath, input.requirementsFile ?? '', input.entrypointScript);
            }
            if (entrypointType === EntrypointType.PackagedExecutable) {
                const entrypointScript = typeof input.entrypointScript === 'string'
                    ? input.entrypointScript.trim()
                    : '';
                if (!entrypointScript) {
                    throw new Error('Packaged executable entrypointScript is required');
                }

                return getPackagedExecutableRuntime(input.binaryObjectPath, entrypointScript);
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
