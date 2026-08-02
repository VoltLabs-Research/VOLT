import LatexDocument from '@modules/latex/models/LatexDocument';
import LatexFile from '@modules/latex/models/LatexFile';
import { requireLatexStorageClusterId } from '@modules/latex/services/LatexAssetStorage';
import { findAssetsByDocument, findEntrypoint } from '@modules/latex/services/latex-queries';
import { fullPathOf, syncWorkDirInputs } from '@modules/latex/services/latex-workdir-sync';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import tempFileService from '@shared/infrastructure/services/TempFileService';
import { spawn } from 'node:child_process';

interface CompilerConfig {
    binary: string;
    args: string[];
}

interface CompilerRunResult {
    success: boolean;
    log: string;
}

interface PrepareWorkDirParams {
    teamId: string;
    documentId: string;
    workDir: string;
}

interface PrepareWorkDirReady {
    status: 'ready';
    compiler: CompilerConfig;
    entrypointFilename: string;
}

interface PrepareWorkDirFailure {
    status: 'no-document' | 'no-files' | 'no-entrypoint' | 'no-compiler';
}

type PrepareWorkDirResult = PrepareWorkDirReady | PrepareWorkDirFailure;

const LATEX_COMPILE_WORKDIR_PREFIX = 'latex-compile-';
const COMPILER_BINARIES = ['latexmk', 'pdflatex', 'xelatex', 'lualatex'] as const;

type CompilerBinary = (typeof COMPILER_BINARIES)[number];

let preferredCompilerBinaryPromise: Promise<CompilerBinary | null> | null = null;

const documentCompileLocks = new Map<string, Promise<void>>();

const normalizeWorkDirToken = (value: string): string => {
    return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
};

export const getDocumentCompileWorkDirSegment = (teamId: string, documentId: string): string => {
    return `${LATEX_COMPILE_WORKDIR_PREFIX}${normalizeWorkDirToken(teamId)}-${normalizeWorkDirToken(documentId)}`;
};

export const withDocumentCompileLock = async <T>(
    teamId: string,
    documentId: string,
    task: () => Promise<T>
): Promise<T> => {
    const lockKey = `${teamId}:${documentId}`;
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

const buildCompilerArgs = (binary: CompilerBinary, entrypoint: string): string[] => [
    ...(binary === 'latexmk' ? ['-pdf'] : []),
    '-interaction=nonstopmode',
    '-halt-on-error',
    '-file-line-error',
    entrypoint
];

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

const resolveCompiler = async (entrypoint: string): Promise<CompilerConfig | null> => {
    const binary = await resolvePreferredCompilerBinary();
    if (!binary) {
        return null;
    }

    return {
        binary,
        args: buildCompilerArgs(binary, entrypoint)
    };
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
            resolve({
                success: code === 0,
                log
            });
        });

        proc.on('error', (err) => {
            resolve({
                success: false,
                log: err.message
            });
        });
    });
};

export const prepareWorkDir = async (params: PrepareWorkDirParams): Promise<PrepareWorkDirResult> => {
    const { teamId, documentId, workDir } = params;

    const document = await LatexDocument.findOneBy({
        id: documentId,
        team: teamId
    });
    if(!document){
        return { status: 'no-document' };
    }
    const storageClusterId = requireLatexStorageClusterId(document.id, document);

    await tempFileService.ensureDir(workDir);

    const latexFiles = await LatexFile.find({
        where: { document: documentId },
        order: {
            isEntrypoint: 'DESC',
            createdAt: 'ASC'
        }
    });
    if (latexFiles.length === 0) {
        return { status: 'no-files' };
    }

    const entrypointFile = findEntrypoint(latexFiles);
    if (!entrypointFile) {
        return { status: 'no-entrypoint' };
    }

    const entrypointFilename = fullPathOf(entrypointFile);

    const [compiler, assets] = await Promise.all([
        resolveCompiler(entrypointFilename),
        findAssetsByDocument(documentId)
    ]);

    if (!compiler) {
        return { status: 'no-compiler' };
    }

    await syncWorkDirInputs(workDir, latexFiles, assets, storageClusterId, objectGatewayClient);

    return {
        status: 'ready',
        compiler,
        entrypointFilename
    };
};
