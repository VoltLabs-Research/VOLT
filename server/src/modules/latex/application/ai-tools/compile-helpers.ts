import { SYS_BUCKETS } from '@core/config/minio';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';

export interface CompilerConfig {
    binary: string;
    args: string[];
};

export interface CompilerRunResult {
    success: boolean;
    log: string;
};

interface BuildCompilerOptions {
    haltOnError?: boolean;
};

export interface PrepareWorkDirDeps {
    latexDocumentRepository: ILatexDocumentRepository;
    latexAssetRepository: ILatexAssetRepository;
    latexFileRepository: ILatexFileRepository;
    storageService: IStorageService;
    tempFileService: ITempFileService;
};

export interface PrepareWorkDirParams {
    teamId: string;
    documentId: string;
    workDir: string;
    haltOnError?: boolean;
};

interface PrepareWorkDirReady {
    status: 'ready';
    compiler: CompilerConfig;
    latexFiles: LatexFile[];
    entrypointFilename: string;
};

interface PrepareWorkDirNoEntrypoint {
    status: 'no-entrypoint';
};

interface PrepareWorkDirNoCompiler {
    status: 'no-compiler';
};

export type PrepareWorkDirResult =
    | PrepareWorkDirReady
    | PrepareWorkDirNoEntrypoint
    | PrepareWorkDirNoCompiler;

export const TEX_EXTENSION = '.tex';

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

const resolveCompiler = async (
    entrypoint: string,
    options?: BuildCompilerOptions
): Promise<CompilerConfig | null> => {
    for (const compiler of buildCompilerConfigs(entrypoint, options)) {
        const found = await new Promise<boolean>((resolve) => {
            const proc = spawn(compiler.binary, ['--version']);
            proc.on('error', () => resolve(false));
            proc.on('close', (code) => resolve(code === 0 || code === 1));
        });
        if (found) return compiler;
    }
    return null;
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
 * Loads the document and its files, writes them to `workDir`, downloads
 * assets from storage, and resolves an available LaTeX compiler.
 *
 * @param params - Document identifiers, working directory path, and compiler options.
 * @param deps - Repository and service dependencies.
 * @returns A discriminated result: `'ready'` with compiler and files, or a failure status.
 * @throws {Error} If the document is not found.
 */
export const prepareWorkDir = async (
    params: PrepareWorkDirParams,
    deps: PrepareWorkDirDeps
): Promise<PrepareWorkDirResult> => {
    const { teamId, documentId, workDir, haltOnError } = params;

    const document = await deps.latexDocumentRepository.findByTeamAndDocumentId(teamId, documentId);
    if (!document) throw new Error('LaTeX document not found.');

    await deps.tempFileService.ensureDir(workDir);

    const latexFiles = await deps.latexFileRepository.findAllByDocument(documentId);
    if (latexFiles.length === 0) {
        return { status: 'no-entrypoint' };
    }

    const entrypointFile = latexFiles.find((f) => f.props.isEntrypoint)
        ?? latexFiles.find((f) => f.props.name.toLowerCase().endsWith(TEX_EXTENSION));

    if (!entrypointFile) {
        return { status: 'no-entrypoint' };
    }

    const entrypointFilename = entrypointFile.fullPath;

    for (const file of latexFiles) {
        const destPath = path.join(workDir, file.fullPath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, file.props.content, 'utf-8');
    }

    const compiler = await resolveCompiler(entrypointFilename, { haltOnError });
    if (!compiler) {
        return { status: 'no-compiler' };
    }

    const assets = await deps.latexAssetRepository.findAllByDocument(documentId);
    for (const asset of assets) {
        try {
            const stream = await deps.storageService.getStream(
                SYS_BUCKETS.LATEX_ASSETS,
                asset.props.storageKey
            );
            const relPath = sanitizeAssetPath(asset.props.path, asset.props.originalName);
            const destPath = path.join(workDir, relPath);
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            await pipeline(stream, createWriteStream(destPath));
        } catch {
            // Skip assets that cannot be retrieved.
        }
    }

    return {
        status: 'ready',
        compiler,
        latexFiles,
        entrypointFilename
    };
};
