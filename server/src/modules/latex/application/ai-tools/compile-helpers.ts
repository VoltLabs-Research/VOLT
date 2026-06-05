import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { requireLatexStorageClusterId } from '@modules/latex/application/utilities/latex-storage';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import pLimit from 'p-limit';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type LatexAsset from '@modules/latex/domain/entities/LatexAsset';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';

interface CompilerConfig {
    binary: string;
    args: string[];
}

interface CompilerRunResult {
    success: boolean;
    log: string;
}

interface BuildCompilerOptions {
    haltOnError?: boolean;
}

interface WorkDirManifest {
    inputs: Record<string, string>;
}

interface SyncableAsset {
    asset: LatexAsset;
    relPath: string;
    version: string;
}

interface PrepareWorkDirDeps {
    latexDocumentRepository: ILatexDocumentRepository;
    latexAssetRepository: ILatexAssetRepository;
    latexFileRepository: ILatexFileRepository;
    objectGatewayClient: TeamClusterObjectGatewayClient;
    tempFileService: ITempFileService;
}

interface PrepareWorkDirParams {
    teamId: string;
    documentId: string;
    workDir: string;
    haltOnError?: boolean;
}

interface PrepareWorkDirReady {
    status: 'ready';
    compiler: CompilerConfig;
    latexFiles: LatexFile[];
    entrypointFilename: string;
}

interface PrepareWorkDirNoDocument {
    status: 'no-document';
}

interface PrepareWorkDirNoFiles {
    status: 'no-files';
}

interface PrepareWorkDirNoEntrypoint {
    status: 'no-entrypoint';
}

interface PrepareWorkDirNoCompiler {
    status: 'no-compiler';
}

type PrepareWorkDirResult =
    | PrepareWorkDirReady
    | PrepareWorkDirNoDocument
    | PrepareWorkDirNoFiles
    | PrepareWorkDirNoEntrypoint
    | PrepareWorkDirNoCompiler;

export const TEX_EXTENSION = '.tex';
const LATEX_COMPILE_WORKDIR_PREFIX = 'latex-compile-';
const WORKDIR_MANIFEST_FILENAME = '.volt-latex-input-manifest.json';
const WORKDIR_SYNC_CONCURRENCY = 8;
const COMPILER_BINARIES = ['latexmk', 'pdflatex', 'xelatex', 'lualatex'] as const;

type CompilerBinary = (typeof COMPILER_BINARIES)[number];

let preferredCompilerBinaryPromise: Promise<CompilerBinary | null> | null = null;

const documentCompileLocks = new Map<string, Promise<void>>();

const normalizeWorkDirToken = (value: string): string => {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
};

const getDocumentCompileLockKey = (teamId: string, documentId: string): string => {
    return `${teamId}:${documentId}`;
};

const getWorkDirManifestPath = (workDir: string): string => {
    return path.join(workDir, WORKDIR_MANIFEST_FILENAME);
};

const buildLatexFileVersion = (file: LatexFile): string => {
    return `${file._id}:${file.fullPath}:${file.props.updatedAt.toISOString()}`;
};

const buildAssetVersion = (asset: LatexAsset, relPath: string): string => {
    return `${asset._id}:${relPath}:${asset.props.storageKey}:${asset.props.size}:${asset.props.updatedAt.toISOString()}`;
};

const pathExistsAsFile = async (targetPath: string): Promise<boolean> => {
    try {
        const stats = await fs.lstat(targetPath);
        return !stats.isDirectory();
    } catch {
        return false;
    }
};

const readWorkDirManifest = async (workDir: string): Promise<WorkDirManifest> => {
    try {
        const rawManifest = await fs.readFile(getWorkDirManifestPath(workDir), 'utf-8');
        const parsedManifest = JSON.parse(rawManifest) as Partial<WorkDirManifest>;
        if (!parsedManifest || typeof parsedManifest !== 'object') {
            return { inputs: {} };
        }

        const inputEntries = parsedManifest.inputs;
        if (!inputEntries || typeof inputEntries !== 'object' || Array.isArray(inputEntries)) {
            return { inputs: {} };
        }

        return {
            inputs: Object.fromEntries(
                Object.entries(inputEntries).filter(([, version]) => typeof version === 'string')
            )
        };
    } catch {
        return { inputs: {} };
    }
};

const writeWorkDirManifest = async (workDir: string, manifest: WorkDirManifest): Promise<void> => {
    await fs.writeFile(getWorkDirManifestPath(workDir), JSON.stringify(manifest), 'utf-8');
};

const pruneEmptyWorkDirParents = async (workDir: string, targetPath: string): Promise<void> => {
    let currentDir = path.dirname(targetPath);

    while (currentDir !== workDir) {
        const entries = await fs.readdir(currentDir).catch(() => null);
        if (!entries || entries.length > 0) {
            return;
        }

        await fs.rmdir(currentDir).catch(() => undefined);
        currentDir = path.dirname(currentDir);
    }
};

const deleteManagedInput = async (workDir: string, relPath: string): Promise<void> => {
    const targetPath = path.join(workDir, relPath);
    await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
    await pruneEmptyWorkDirParents(workDir, targetPath);
};

const ensureWritableInputPath = async (targetPath: string): Promise<void> => {
    const stats = await fs.lstat(targetPath).catch(() => null);
    if (stats?.isDirectory()) {
        await fs.rm(targetPath, { recursive: true, force: true });
    }
};

const buildSyncableAssets = (assets: LatexAsset[]): SyncableAsset[] => {
    return assets.map((asset) => {
        const relPath = sanitizeAssetPath(asset.props.path, asset.props.originalName);
        return {
            asset,
            relPath,
            version: buildAssetVersion(asset, relPath)
        };
    });
};

const syncWorkDirInputs = async (
    workDir: string,
    latexFiles: LatexFile[],
    assets: LatexAsset[],
    storageClusterId: string,
    objectGatewayClient: TeamClusterObjectGatewayClient
): Promise<void> => {
    const limit = pLimit(WORKDIR_SYNC_CONCURRENCY);
    const previousManifest = await readWorkDirManifest(workDir);
    const syncableAssets = buildSyncableAssets(assets);
    const nextExpectedInputs = new Map<string, string>();
    const syncedInputs = new Map<string, string>();

    for (const file of latexFiles) {
        nextExpectedInputs.set(file.fullPath, buildLatexFileVersion(file));
    }

    for (const asset of syncableAssets) {
        nextExpectedInputs.set(asset.relPath, asset.version);
    }

    const staleInputs = Object.keys(previousManifest.inputs)
        .filter((relPath) => !nextExpectedInputs.has(relPath));

    await Promise.all(staleInputs.map((relPath) => {
        return limit(() => deleteManagedInput(workDir, relPath));
    }));

    await Promise.all(latexFiles.map((file) => {
        return limit(async () => {
            const relPath = file.fullPath;
            const version = nextExpectedInputs.get(relPath)!;
            const destPath = path.join(workDir, relPath);

            if (previousManifest.inputs[relPath] === version && await pathExistsAsFile(destPath)) {
                syncedInputs.set(relPath, version);
                return;
            }

            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await ensureWritableInputPath(destPath);
            await fs.writeFile(destPath, file.props.content, 'utf-8');
            syncedInputs.set(relPath, version);
        });
    }));

    await Promise.all(syncableAssets.map((syncableAsset) => {
        return limit(async () => {
            const { asset, relPath, version } = syncableAsset;
            const destPath = path.join(workDir, relPath);

            if (previousManifest.inputs[relPath] === version && await pathExistsAsFile(destPath)) {
                syncedInputs.set(relPath, version);
                return;
            }

            try {
                const stream = (await objectGatewayClient.getStream(
                    storageClusterId,
                    TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    asset.props.storageKey
                )).stream;

                await fs.mkdir(path.dirname(destPath), { recursive: true });
                await ensureWritableInputPath(destPath);
                await pipeline(stream, createWriteStream(destPath));
                syncedInputs.set(relPath, version);
            } catch {
                await deleteManagedInput(workDir, relPath);
            }
        });
    }));

    await writeWorkDirManifest(workDir, {
        inputs: Object.fromEntries(syncedInputs)
    });
};

export const getDocumentCompileWorkDirSegment = (teamId: string, documentId: string): string => {
    return `${LATEX_COMPILE_WORKDIR_PREFIX}${normalizeWorkDirToken(teamId)}-${normalizeWorkDirToken(documentId)}`;
};

export const withDocumentCompileLock = async <T>(
    teamId: string,
    documentId: string,
    task: () => Promise<T>
): Promise<T> => {
    const lockKey = getDocumentCompileLockKey(teamId, documentId);
    const previousLock = documentCompileLocks.get(lockKey) ?? Promise.resolve();

    let releaseCurrentLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
        releaseCurrentLock = resolve;
    });

    const queuedLock = previousLock.then(() => currentLock);
    documentCompileLocks.set(lockKey, queuedLock);

    await previousLock;

    try {
        return await task();
    } finally {
        releaseCurrentLock();

        if (documentCompileLocks.get(lockKey) === queuedLock) {
            documentCompileLocks.delete(lockKey);
        }
    }
};

const buildCompilerConfigs = (entrypoint: string, options?: BuildCompilerOptions): CompilerConfig[] => {
    const haltFlag = options?.haltOnError ? ['-halt-on-error'] : [];
    return [
        {
            binary: 'latexmk',
            args: ['-pdf', '-interaction=nonstopmode', ...haltFlag, '-file-line-error', entrypoint]
        },
        {
            binary: 'pdflatex',
            args: ['-interaction=nonstopmode', ...haltFlag, '-file-line-error', entrypoint]
        },
        {
            binary: 'xelatex',
            args: ['-interaction=nonstopmode', ...haltFlag, '-file-line-error', entrypoint]
        },
        {
            binary: 'lualatex',
            args: ['-interaction=nonstopmode', ...haltFlag, '-file-line-error', entrypoint]
        }
    ];
};

const buildCompileEnv = (workDir: string): NodeJS.ProcessEnv => ({
    ...process.env,
    TEXINPUTS: `.//:./:${workDir}//:${process.env['TEXINPUTS'] ?? ''}`,
    BIBINPUTS: `.//:./:${workDir}//:${process.env['BIBINPUTS'] ?? ''}`,
    BSTINPUTS: `.//:./:${workDir}//:${process.env['BSTINPUTS'] ?? ''}`,
});

const resolvePreferredCompilerBinary = async (): Promise<CompilerBinary | null> => {
    preferredCompilerBinaryPromise ??= (async () => {
        for (const binary of COMPILER_BINARIES) {
            const found = await new Promise<boolean>((resolve) => {
                const proc = spawn(binary, ['--version']);
                proc.on('error', () => resolve(false));
                proc.on('close', (code) => resolve(code === 0 || code === 1));
            });

            if (found) {
                return binary;
            }
        }

        return null;
    })();

    return preferredCompilerBinaryPromise;
};

const resolveCompiler = async (
    entrypoint: string,
    options?: BuildCompilerOptions
): Promise<CompilerConfig | null> => {
    const preferredCompilerBinary = await resolvePreferredCompilerBinary();
    if (!preferredCompilerBinary) {
        return null;
    }

    return buildCompilerConfigs(entrypoint, options)
        .find((compiler) => compiler.binary === preferredCompilerBinary) ?? null;
};

export const runCompiler = (compiler: CompilerConfig, workDir: string): Promise<CompilerRunResult> => {
    return new Promise((resolve) => {
        const proc = spawn(compiler.binary, compiler.args, {
            cwd: workDir,
            env: buildCompileEnv(workDir)
        });
        let log = '';

        proc.stdout.on('data', (chunk: Buffer) => {
            log += chunk.toString('utf-8');
        });

        proc.stderr.on('data', (chunk: Buffer) => {
            log += chunk.toString('utf-8');
        });

        proc.on('close', (code) => {
            resolve({ success: code === 0, log });
        });

        proc.on('error', (err) => {
            resolve({ success: false, log: err.message });
        });
    });
};

/**
 * Prepares a temporary working directory for LaTeX compilation.
 *
 * Loads the document and its files, incrementally syncs only changed inputs
 * into `workDir`, downloads changed assets from storage, and resolves an
 * available LaTeX compiler.
 *
 * @param params - Document identifiers, working directory path, and compiler options.
 * @param deps - Repository and service dependencies.
 * @returns A discriminated result: `'ready'` with compiler and files, or a failure status.
 */
export const prepareWorkDir = async (
    params: PrepareWorkDirParams,
    deps: PrepareWorkDirDeps
): Promise<PrepareWorkDirResult> => {
    const { teamId, documentId, workDir, haltOnError } = params;

    const document = await deps.latexDocumentRepository.findByTeamAndDocumentId(teamId, documentId);
    if (!document) {
        return { status: 'no-document' };
    }
    const storageClusterId = requireLatexStorageClusterId(document._id, document.props);

    await deps.tempFileService.ensureDir(workDir);

    const latexFiles = await deps.latexFileRepository.findAllByDocument(documentId);
    if (latexFiles.length === 0) {
        return { status: 'no-files' };
    }

    const entrypointFile = latexFiles.find((f) => f.props.isEntrypoint)
        ?? latexFiles.find((f) => f.props.name.toLowerCase().endsWith(TEX_EXTENSION));

    if (!entrypointFile) {
        return { status: 'no-entrypoint' };
    }

    const entrypointFilename = entrypointFile.fullPath;

    const [compiler, assets] = await Promise.all([
        resolveCompiler(entrypointFilename, { haltOnError }),
        deps.latexAssetRepository.findAllByDocument(documentId)
    ]);

    if (!compiler) {
        return { status: 'no-compiler' };
    }

    await syncWorkDirInputs(workDir, latexFiles, assets, storageClusterId, deps.objectGatewayClient);

    return {
        status: 'ready',
        compiler,
        latexFiles,
        entrypointFilename
    };
};
