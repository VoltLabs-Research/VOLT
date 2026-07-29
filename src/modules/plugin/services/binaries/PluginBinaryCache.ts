import { singleton } from '@shared/application/utilities/singleton';
import type { PluginExecutionRuntime, PluginExecutionRuntimeInput } from '@shared/contracts/types/plugin-execution';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import { DAEMON_PATHS } from '@core/config/paths';
import type { DaemonConfig } from '@core/config/daemon';
import { createReadStream, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createZstdDecompress, createZstdCompress } from 'node:zlib';
import { Open as UnzipperOpen } from 'unzipper';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EntrypointType } from '@shared/contracts/types/http-runtime';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { Readable } from 'node:stream';
import * as tar from 'tar';

type ExecutionRuntimeInput = PluginExecutionRuntimeInput;

type ExecutionRuntime = PluginExecutionRuntime;

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

export interface PluginWarmupImageDescriptor {
    pluginId: string;
    binaryHash: string;
    tarballObjectKey: string;
    createdAt: string;
    requirements: string;
    entrypointScript?: string;
    venvRelativePath: string;
    projectRelativePath: string;
}

const MAX_STDERR_BYTES = 10 * 1024 * 1024;

const runCommand = (commandPath: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(commandPath, args, {
            cwd,
            env: {
                ...process.env,
                ...env
            },
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
const WARM_IMAGE_MARKER_FILENAME = '.warm-image-applied';
const WARM_IMAGE_BUCKET = ObjectBucketName.Plugins;
const WARM_IMAGE_OBJECT_KEY_PREFIX = 'plugins/warm/';
const WARM_IMAGE_EXTENSION = 'warm.tar.zst';
const WARM_IMAGE_METADATA_KEY = 'warm-image-descriptor';
const STUB_MSGPACK_REQUIREMENT = 'msgpack';

const buildCacheKey = (binaryObjectPath: string, ownerClusterId: string, expectedHash?: string): string => {
    const basename = path.basename(binaryObjectPath);
    const digest = createHash('sha256')
        .update(ownerClusterId)
        .update('\0')
        .update(binaryObjectPath)
        .update('\0');

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

const extractZipInProcess = async (zipPath: string, destinationDir: string): Promise<void> => {
    const directory = await UnzipperOpen.file(zipPath);
    for (const entry of directory.files) {
        const normalized = normalizeProjectRelativePath(entry.path);
        if (!normalized || normalized.startsWith('__MACOSX')) {
            continue;
        }

        const targetPath = path.join(destinationDir, normalized);
        const relativeToDest = path.relative(destinationDir, targetPath);
        if (relativeToDest.startsWith('..') || path.isAbsolute(relativeToDest)) {
            continue;
        }

        if (entry.type === 'Directory') {
            await fs.mkdir(targetPath, { recursive: true });
            continue;
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await pipeline(entry.stream(), createWriteStream(targetPath));
    }
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

const readOptionalMetadata = (metadata: Record<string, string | undefined>, key: string): string | undefined => {
    const value = metadata[key] ?? metadata[`x-amz-meta-${key}`];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const warmImageObjectKeyFor = (binaryHash: string): string => {
    return `${WARM_IMAGE_OBJECT_KEY_PREFIX}${binaryHash}.${WARM_IMAGE_EXTENSION}`;
};

export class PluginBinaryCache {
    private readonly binaryCachePromises = new Map<string, Promise<string>>();
    private readonly pythonRuntimePromises = new Map<string, Promise<ExecutionRuntime>>();
    private readonly packagedRuntimePromises = new Map<string, Promise<ExecutionRuntime>>();

    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly config: DaemonConfig
    ) {}

    async getExecutionRuntime(input: ExecutionRuntimeInput): Promise<ExecutionRuntime> {
        const entrypointType = input.entrypointType ?? EntrypointType.Executable;
        if (entrypointType === EntrypointType.PythonScript) {
            return this.getPythonRuntime(
                input.binaryObjectPath,
                input.ownerClusterId,
                input.requirementsFile ?? '',
                input.entrypointScript
            );
        }
        if (entrypointType === EntrypointType.PackagedExecutable) {
            const entrypointScript = input.entrypointScript;
            if (!entrypointScript) {
                throw new Error('Packaged executable entrypointScript is required');
            }

            return this.getPackagedExecutableRuntime(input.binaryObjectPath, input.ownerClusterId, entrypointScript);
        }

        const artifactPath = await this.getCachedBinaryPath(input.binaryObjectPath, input.ownerClusterId);
        const source = await this.resolvePluginBinarySource(input.binaryObjectPath, input.ownerClusterId);
        return {
            artifactPath,
            commandPath: artifactPath,
            argsPrefix: [],
            binaryHash: source.expectedHash
        };
    }

    async warmUpPlugin(input: {
        pluginId: string;
        binaryObjectPath: string;
        ownerClusterId?: string;
        requirementsFile: string;
        entrypointScript?: string;
    }): Promise<PluginWarmupImageDescriptor> {
        const runtime = await this.getPythonRuntime(
            input.binaryObjectPath,
            input.ownerClusterId,
            input.requirementsFile,
            input.entrypointScript
        );
        const source = await this.resolvePluginBinarySource(input.binaryObjectPath, input.ownerClusterId);
        const binaryHash = source.expectedHash ?? createHash('sha256').update(runtime.artifactPath).digest('hex');
        return this.publishWarmImage({
            pluginId: input.pluginId,
            binaryObjectPath: input.binaryObjectPath,
            ownerClusterId: source.ownerClusterId,
            binaryHash,
            runtime,
            requirements: input.requirementsFile,
            entrypointScript: input.entrypointScript
        });
    }

    async ensureWarmPluginRestored(binaryObjectPath: string, ownerClusterId?: string): Promise<boolean> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath, ownerClusterId);
        if (!source.expectedHash) {
            return false;
        }

        const warmObjectKey = warmImageObjectKeyFor(source.expectedHash);
        const runtimeKey = this.computePythonRuntimeKey(
            binaryObjectPath,
            source.ownerClusterId,
            source.expectedHash,
            ''
        );
        const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKey);
        const appliedMarker = path.join(runtimeDirectory, WARM_IMAGE_MARKER_FILENAME);

        try {
            const existingMarker = await fs.readFile(appliedMarker, 'utf-8');
            if (existingMarker === source.expectedHash) {
                return true;
            }
        } catch {
        }

        try {
            const response = await this.objectStore.getStream(
                this.config.teamClusterId,
                WARM_IMAGE_BUCKET,
                warmObjectKey,
                { skipMetadata: true }
            );
            await fs.mkdir(runtimeDirectory, { recursive: true });
            await pipeline(
                response.stream,
                createZstdDecompress(),
                tar.x({ cwd: runtimeDirectory })
            );
            await fs.writeFile(appliedMarker, source.expectedHash, 'utf-8');
            logger.info({
                binaryObjectPath,
                runtimeKey
            }, '@plugin-binary-cache: warm image applied');
            return true;
        } catch (error: unknown) {
            if (this.isStorageNotFound(error)) {
                return false;
            }
            logger.warn({
                err: error,
                warmObjectKey
            }, '@plugin-binary-cache: warm image restore failed');
            return false;
        }
    }

    private async publishWarmImage(input: {
        pluginId: string;
        binaryObjectPath: string;
        ownerClusterId: string;
        binaryHash: string;
        runtime: ExecutionRuntime;
        requirements: string;
        entrypointScript?: string;
    }): Promise<PluginWarmupImageDescriptor> {
        const runtimeKey = this.computePythonRuntimeKey(
            input.binaryObjectPath,
            input.ownerClusterId,
            input.binaryHash,
            input.requirements
        );
        const runtimeDirectory = path.join(DAEMON_PATHS.pluginBinCache, runtimeKey);
        const warmObjectKey = warmImageObjectKeyFor(input.binaryHash);
        const descriptor: PluginWarmupImageDescriptor = {
            pluginId: input.pluginId,
            binaryHash: input.binaryHash,
            tarballObjectKey: warmObjectKey,
            createdAt: new Date().toISOString(),
            requirements: input.requirements,
            entrypointScript: input.entrypointScript,
            venvRelativePath: PYTHON_VENV_DIRECTORY,
            projectRelativePath: PYTHON_PROJECT_DIRECTORY
        };

        const candidateEntries = [
            PYTHON_VENV_DIRECTORY,
            PYTHON_PROJECT_DIRECTORY,
            PYTHON_REQUIREMENTS_FILENAME,
            PYTHON_INSTALL_MARKER_FILENAME,
            PYTHON_ZIP_EXTRACTED_MARKER
        ];
        const presentEntries: string[] = [];
        for (const entry of candidateEntries) {
            try {
                await fs.access(path.join(runtimeDirectory, entry));
                presentEntries.push(entry);
            } catch {
            }
        }

        if (presentEntries.length === 0) {
            throw new Error(`Warm image has nothing to package for plugin ${input.pluginId}`);
        }

        const packStream = tar.c(
            {
                cwd: runtimeDirectory,
                gzip: false,
                portable: true
            },
            presentEntries
        ) as Readable;

        const buffers: Buffer[] = [];
        const compressed = packStream.pipe(createZstdCompress());
        for await (const chunk of compressed) {
            buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer));
        }
        const tarball = Buffer.concat(buffers);

        await this.objectStore.putObject({
            ownerClusterId: this.config.teamClusterId,
            bucket: WARM_IMAGE_BUCKET,
            objectKey: warmObjectKey,
            body: tarball,
            metadata: {
                'content-type': 'application/x-tar+zstd',
                [WARM_IMAGE_METADATA_KEY]: JSON.stringify(descriptor),
                'plugin-id': input.pluginId,
                'binary-hash': input.binaryHash
            }
        });

        const appliedMarker = path.join(runtimeDirectory, WARM_IMAGE_MARKER_FILENAME);
        await fs.writeFile(appliedMarker, input.binaryHash, 'utf-8').catch(() => {});
        return descriptor;
    }

    private async resolvePluginBinarySource(
        binaryObjectPath: string,
        ownerClusterId?: string
    ): Promise<ResolvedPluginBinarySource> {
        const resolvedOwnerClusterId = ownerClusterId && ownerClusterId.length > 0
            ? ownerClusterId
            : this.config.teamClusterId;
        const headResponse = await this.objectStore.head(
            resolvedOwnerClusterId,
            PLUGINS_BUCKET,
            binaryObjectPath
        );

        return {
            ownerClusterId: resolvedOwnerClusterId,
            expectedHash: readOptionalMetadata(headResponse.metadata, 'sha256')
        };
    }

    private async getBinaryPath(binaryObjectPath: string, ownerClusterId?: string): Promise<string> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath, ownerClusterId);
        const cacheKey = buildCacheKey(binaryObjectPath, source.ownerClusterId, source.expectedHash);
        const localPath = path.join(DAEMON_PATHS.pluginBinCache, cacheKey);

        try {
            await fs.access(localPath, fs.constants.X_OK);
            const cachedHash = await fs.readFile(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, 'utf-8')
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

        const tempPath = `${localPath}.partial-${process.pid}-${Date.now()}`;
        const response = await this.objectStore.getStream(source.ownerClusterId, PLUGINS_BUCKET, binaryObjectPath, {
            skipMetadata: true
        });

        try {
            await pipeline(response.stream, createWriteStream(tempPath));
            if (source.expectedHash) {
                const computedHash = await computeFileHash(tempPath);
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
                    throw new Error(`Downloaded plugin binary hash mismatch for ${binaryObjectPath}`);
                }
            }

            await fs.chmod(tempPath, 0o755);
            await fs.rename(tempPath, localPath);

            if (source.expectedHash) {
                await fs.writeFile(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, source.expectedHash, 'utf-8');
            } else {
                await fs.rm(`${localPath}${HASH_MARKER_FILENAME_SUFFIX}`, { force: true }).catch(() => {});
            }
        } catch (error) {
            await fs.rm(tempPath, { force: true }).catch(() => {});
            throw error;
        }

        logger.info(`Binary cached: ${binaryObjectPath} -> ${localPath}`);
        return localPath;
    }

    private async getCachedBinaryPath(binaryObjectPath: string, ownerClusterId?: string): Promise<string> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath, ownerClusterId);
        const cacheKey = buildCacheKey(binaryObjectPath, source.ownerClusterId, source.expectedHash);
        const existingPromise = this.binaryCachePromises.get(cacheKey);
        if (existingPromise) {
            return existingPromise;
        }

        const nextPromise = this.getBinaryPath(binaryObjectPath, source.ownerClusterId)
            .finally(() => {
                this.binaryCachePromises.delete(cacheKey);
            });

        this.binaryCachePromises.set(cacheKey, nextPromise);
        return nextPromise;
    }

    private computePythonRuntimeKey(
        binaryObjectPath: string,
        ownerClusterId: string,
        expectedHash: string | undefined,
        requirementsFile: string
    ): string {
        const runtimeKey = createHash('sha256')
            .update(ownerClusterId)
            .update('\0')
            .update(binaryObjectPath)
            .update('\0');
        if (expectedHash) {
            runtimeKey.update(expectedHash);
        }
        runtimeKey.update('\0').update(requirementsFile);
        return runtimeKey.digest('hex');
    }

    private async getPythonRuntime(
        binaryObjectPath: string,
        ownerClusterId: string | undefined,
        requirementsFile: string,
        entrypointScript?: string
    ): Promise<ExecutionRuntime> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath, ownerClusterId);
        const artifactPath = await this.getCachedBinaryPath(binaryObjectPath, source.ownerClusterId);
        const runtimeKeyDigest = this.computePythonRuntimeKey(
            binaryObjectPath,
            source.ownerClusterId,
            source.expectedHash,
            requirementsFile
        );
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

            await this.ensureWarmPluginRestored(binaryObjectPath, source.ownerClusterId).catch((error: unknown) => {
                logger.warn({
                    err: error,
                    binaryObjectPath
                }, '@plugin-binary-cache: warm prefetch failed');
            });

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
                    await fs.rm(projectDir, {
                        recursive: true,
                        force: true
                    });
                    await fs.mkdir(projectDir, { recursive: true });
                    await extractZipInProcess(artifactPath, projectDir);
                    await fs.writeFile(extractMarkerPath, extractMarkerValue, 'utf-8');
                }

                const resolvedEntrypoint = await resolveExtractedPythonEntrypoint(projectDir, entrypointScript);
                scriptPath = resolvedEntrypoint.scriptPath;
                projectRootDir = resolvedEntrypoint.projectRootDir;
            }

            const requirementsPath = entrypointScript
                ? path.join(projectRootDir, PYTHON_PROJECT_REQUIREMENTS_FILENAME)
                : path.join(runtimeDirectory, PYTHON_REQUIREMENTS_FILENAME);
            const requirementsWithStub = this.ensureStubRequirements(requirementsFile);
            const currentRequirements = await fs.readFile(requirementsPath, 'utf-8').catch(() => null);
            if (currentRequirements !== requirementsWithStub) {
                await fs.writeFile(requirementsPath, requirementsWithStub, 'utf-8');
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
                projectPath: entrypointScript ? projectRootDir : undefined,
                binaryHash: source.expectedHash
            };
        })().finally(() => {
            this.pythonRuntimePromises.delete(runtimeKeyDigest);
        });

        this.pythonRuntimePromises.set(runtimeKeyDigest, nextPromise);
        return nextPromise;
    }

    private ensureStubRequirements(requirementsFile: string): string {
        const lines = requirementsFile.split(/\r?\n/);
        const hasMsgpack = lines.some((line) => /^\s*msgpack\b/i.test(line));
        if (hasMsgpack) {
            return requirementsFile;
        }
        const normalized = requirementsFile.endsWith('\n') || requirementsFile === ''
            ? requirementsFile
            : `${requirementsFile}\n`;
        return `${normalized}${STUB_MSGPACK_REQUIREMENT}\n`;
    }

    private isStorageNotFound(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const candidate = error as {
            code?: string;
            Code?: string;
            statusCode?: number;
            name?: string;
        };
        if (candidate.statusCode === 404) {
            return true;
        }
        const code = candidate.code ?? candidate.Code ?? candidate.name ?? '';
        return /NotFound|NoSuchKey/i.test(code);
    }

    private async getPackagedExecutableRuntime(
        binaryObjectPath: string,
        ownerClusterId: string | undefined,
        entrypointScript: string
    ): Promise<ExecutionRuntime> {
        const source = await this.resolvePluginBinarySource(binaryObjectPath, ownerClusterId);
        const artifactPath = await this.getCachedBinaryPath(binaryObjectPath, source.ownerClusterId);
        const runtimeKey = createHash('sha256')
            .update(source.ownerClusterId)
            .update('\0')
            .update(binaryObjectPath)
            .update('\0');
        if (source.expectedHash) {
            runtimeKey.update(source.expectedHash);
        }
        runtimeKey.update('\0').update(entrypointScript);
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
                await fs.rm(projectDir, {
                    recursive: true,
                    force: true
                });
                await fs.mkdir(projectDir, { recursive: true });
                await extractZipInProcess(artifactPath, projectDir);
                await fs.writeFile(extractMarkerPath, extractMarkerValue, 'utf-8');
            }

            const resolvedEntrypoint = await resolveExtractedPackagedEntrypoint(projectDir, entrypointScript);
            await fs.chmod(resolvedEntrypoint.commandPath, 0o755).catch(() => {});
            const libraryPath = path.join(projectDir, 'lib');
            const existingLibraryPath = process.env.LD_LIBRARY_PATH;

            return {
                artifactPath,
                commandPath: resolvedEntrypoint.commandPath,
                argsPrefix: [],
                env: {
                    LD_LIBRARY_PATH: existingLibraryPath
                        ? `${libraryPath}:${existingLibraryPath}`
                        : libraryPath
                },
                projectPath: projectDir,
                binaryHash: source.expectedHash
            };
        })().finally(() => {
            this.packagedRuntimePromises.delete(runtimeKeyDigest);
        });

        this.packagedRuntimePromises.set(runtimeKeyDigest, nextPromise);
        return nextPromise;
    }
}

export const getPluginBinaryCache = singleton((): PluginBinaryCache => new PluginBinaryCache(getObjectStore(), getConfig()));
