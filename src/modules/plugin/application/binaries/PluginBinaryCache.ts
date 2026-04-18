import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { createReadStream, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import { ObjectBucketName, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/core/storage/contracts/http-object-store';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';

interface ExecutionRuntimeInput {
    binaryObjectPath: string;
    entrypointType?: EntrypointType;
    requirementsFile?: string;
    entrypointScript?: string;
}

interface ExecutionRuntime {
    artifactPath: string;
    commandPath: string;
    argsPrefix: string[];
    env?: NodeJS.ProcessEnv;
    projectPath?: string;
}

interface ResolvedPluginBinarySource {
    ownerClusterId: string;
    expectedHash?: string;
}

interface ResolvedPythonEntrypoint {
    scriptPath: string;
    projectRootDir: string;
    resolvedRelativePath: string;
}

interface ResolvedPackagedEntrypoint {
    commandPath: string;
    projectRootDir: string;
    resolvedRelativePath: string;
}

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

            const stderrOutput = Buffer.concat(stderrChunks).toString('utf-8');
            reject(new Error(stderrOutput.length > 0 ? stderrOutput : `${commandPath} exited with code ${code}`));
        });
    });
};

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
        .update('\u0000');

    if (expectedHash) {
        digest.update(expectedHash);
    }

    return `${digest.digest('hex')}-${basename}`;
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
    return fg('**/*', {
        cwd: directoryPath,
        onlyFiles: true,
        dot: true,
        unique: true,
        ignore: [
            '__MACOSX',
            '**/__MACOSX/**'
        ]
    });
};

const resolveExtractedPythonEntrypoint = async (
    projectDir: string,
    entrypointScript: string
): Promise<ResolvedPythonEntrypoint> => {
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
): Promise<ResolvedPackagedEntrypoint> => {
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

export class PluginBinaryCache {
    private readonly binaryCachePromises = new Map<string, Promise<string>>();
    private readonly pythonRuntimePromises = new Map<string, Promise<ExecutionRuntime>>();
    private readonly packagedRuntimePromises = new Map<string, Promise<ExecutionRuntime>>();

    constructor(private readonly objectStore: ClusterObjectStore) {}

    async getExecutionRuntime(input: ExecutionRuntimeInput): Promise<ExecutionRuntime> {
        const entrypointType = input.entrypointType ?? EntrypointType.Executable;
        if (entrypointType === EntrypointType.PythonScript) {
            if (input.requirementsFile === undefined) {
                return this.getPythonRuntime(input.binaryObjectPath, '', input.entrypointScript);
            }

            return this.getPythonRuntime(input.binaryObjectPath, input.requirementsFile, input.entrypointScript);
        }
        if (entrypointType === EntrypointType.PackagedExecutable) {
            const entrypointScript = input.entrypointScript;
            if (!entrypointScript) {
                throw new Error('Packaged executable entrypointScript is required');
            }

            return this.getPackagedExecutableRuntime(input.binaryObjectPath, entrypointScript);
        }

        const artifactPath = await this.getCachedBinaryPath(input.binaryObjectPath);
        return {
            artifactPath,
            commandPath: artifactPath,
            argsPrefix: []
        };
    }

    private async resolvePluginBinarySource(binaryObjectPath: string): Promise<ResolvedPluginBinarySource> {
        const headResponse = await this.objectStore.head(
            VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            PLUGINS_BUCKET,
            binaryObjectPath
        );

        return {
            ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            expectedHash: headResponse.metadata.sha256
        };
    }

    private async getBinaryPath(binaryObjectPath: string): Promise<string> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath);
        const cacheKey = buildCacheKey(binaryObjectPath, source.expectedHash);
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, cacheKey);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            const cachedHash = await fs.readFile(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, 'utf-8')
                .then((value) => value)
                .catch(() => null);
            if (!source.expectedHash || cachedHash === source.expectedHash) {
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

        const response = await this.objectStore.getStream(source.ownerClusterId, PLUGINS_BUCKET, binaryObjectPath, {
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

        if (source.expectedHash) {
            await fs.writeFile(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, source.expectedHash, 'utf-8');
        } else {
            await fs.rm(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, { force: true }).catch(() => {});
        }
        await fs.chmod(localPath, 0o755);

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    }

    private async getCachedBinaryPath(binaryObjectPath: string): Promise<string> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath);
        const cacheKey = buildCacheKey(binaryObjectPath, source.expectedHash);
        const existingPromise = this.binaryCachePromises.get(cacheKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = this.getBinaryPath(binaryObjectPath)
            .finally(() => {
                this.binaryCachePromises.delete(cacheKey);
            });

        this.binaryCachePromises.set(cacheKey, nextPromise);
        return nextPromise;
    }

    private async getPythonRuntime(
        binaryObjectPath: string,
        requirementsFile: string,
        entrypointScript?: string
    ): Promise<ExecutionRuntime> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath);
        const artifactPath = await this.getCachedBinaryPath(binaryObjectPath);
        const runtimeKey = createHash('sha256')
            .update(binaryObjectPath)
            .update('\u0000');
        if (source.expectedHash) {
            runtimeKey.update(source.expectedHash);
        }
        runtimeKey.update('\u0000').update(requirementsFile);
        const runtimeKeyDigest = runtimeKey.digest('hex');
        const existingPromise = this.pythonRuntimePromises.get(runtimeKeyDigest);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = (async (): Promise<ExecutionRuntime> => {
            const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKeyDigest);
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
                    if (currentMarker !== extractMarkerValue) {
                        throw new Error('stale python project marker');
                    }
                } catch {
                    await fs.rm(projectDir, { recursive: true, force: true });
                    await fs.mkdir(projectDir, { recursive: true });
                    await runCommand('unzip', ['-o', artifactPath, '-d', projectDir], runtimeDirectory);
                    await fs.writeFile(extractMarkerPath, extractMarkerValue, 'utf-8');
                }

                const resolvedEntrypoint = await resolveExtractedPythonEntrypoint(projectDir, entrypointScript);
                scriptPath = resolvedEntrypoint.scriptPath;
                projectRootDir = resolvedEntrypoint.projectRootDir;
            }

            const requirementsPath = entrypointScript
                ? path.join(projectRootDir, PYTHON_PROJECT_REQUIREMENTS_FILENAME)
                : path.join(runtimeDirectory, PYTHON_REQUIREMENTS_FILENAME);
            const currentRequirements = await fs.readFile(requirementsPath, 'utf-8').catch(() => null);
            if (currentRequirements !== requirementsFile) {
                await fs.writeFile(requirementsPath, requirementsFile, 'utf-8');
            }

            try {
                await fs.access(pythonPath, fs.constants.X_OK);
            } catch {
                await runCommand('python3', ['-m', 'venv', venvPath], runtimeDirectory);
            }

            try {
                await fs.access(installMarkerPath, fs.constants.F_OK);
            } catch {
                await runCommand(pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], projectRootDir);
                await fs.writeFile(installMarkerPath, runtimeKeyDigest, 'utf-8');
            }

            const runtimeEnv: NodeJS.ProcessEnv = {
                VIRTUAL_ENV: venvPath,
                PATH: `${path.join(venvPath, 'bin')}:${process.env.PATH}`
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
            this.pythonRuntimePromises.delete(runtimeKeyDigest);
        });

        this.pythonRuntimePromises.set(runtimeKeyDigest, nextPromise);
        return nextPromise;
    }

    private async getPackagedExecutableRuntime(
        binaryObjectPath: string,
        entrypointScript: string
    ): Promise<ExecutionRuntime> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath);
        const artifactPath = await this.getCachedBinaryPath(binaryObjectPath);
        const runtimeKey = createHash('sha256')
            .update(binaryObjectPath)
            .update('\u0000');
        if (source.expectedHash) {
            runtimeKey.update(source.expectedHash);
        }
        runtimeKey.update('\u0000').update(entrypointScript);
        const runtimeKeyDigest = runtimeKey.digest('hex');
        const existingPromise = this.packagedRuntimePromises.get(runtimeKeyDigest);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = (async (): Promise<ExecutionRuntime> => {
            const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKeyDigest);
            const projectDir = path.join(runtimeDirectory, PACKAGED_PROJECT_DIRECTORY);
            const extractMarkerPath = path.join(runtimeDirectory, PACKAGED_ZIP_EXTRACTED_MARKER);
            const extractMarkerValue = source.expectedHash || artifactPath;

            await fs.mkdir(runtimeDirectory, { recursive: true });

            try {
                const currentMarker = await fs.readFile(extractMarkerPath, 'utf-8');
                if (currentMarker !== extractMarkerValue) {
                    throw new Error('stale packaged project marker');
                }
            } catch {
                await fs.rm(projectDir, { recursive: true, force: true });
                await fs.mkdir(projectDir, { recursive: true });
                await runCommand('unzip', ['-o', artifactPath, '-d', projectDir], runtimeDirectory);
                await fs.writeFile(extractMarkerPath, extractMarkerValue, 'utf-8');
            }

            const resolvedEntrypoint = await resolveExtractedPackagedEntrypoint(projectDir, entrypointScript);
            await fs.chmod(resolvedEntrypoint.commandPath, 0o755).catch(() => {});

            return {
                artifactPath,
                commandPath: resolvedEntrypoint.commandPath,
                argsPrefix: [],
                projectPath: resolvedEntrypoint.projectRootDir
            };
        })().finally(() => {
            this.packagedRuntimePromises.delete(runtimeKeyDigest);
        });

        this.packagedRuntimePromises.set(runtimeKeyDigest, nextPromise);
        return nextPromise;
    }
}
