import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import type { CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO } from '@modules/latex/application/dtos/CompileLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';

interface CompilerRunResult {
    success: boolean;
    log: string;
};

interface CompilerConfig {
    binary: string;
    args: string[];
};

/**
 * Compiler priority order:
 * 1. latexmk  — preferred; handles multi-pass builds, BibTeX, glossaries automatically.
 * 2. pdflatex — widest compatibility for standard documents.
 * 3. xelatex  — Unicode / OpenType font support.
 * 4. lualatex — Lua scripting, advanced font support.
 *
 * The entrypoint filename is injected at runtime from the LatexFile marked `isEntrypoint`.
 */
const buildCompilerConfigs = (entrypoint: string): CompilerConfig[] => [
    {
        binary: 'latexmk',
        args: ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', entrypoint]
    },
    {
        binary: 'pdflatex',
        args: ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', entrypoint]
    },
    {
        binary: 'xelatex',
        args: ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', entrypoint]
    },
    {
        binary: 'lualatex',
        args: ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', entrypoint]
    }
];

/**
 * Builds the environment for the compiler process.
 *
 * `TEXINPUTS`, `BIBINPUTS`, and `BSTINPUTS` all include the workDir with recursive
 * search (`//`) so that `.cls`, `.sty`, `.bib`, `.bst`, and image assets placed in
 * any subdirectory of workDir are always found by the compiler.
 */
const buildCompileEnv = (workDir: string): NodeJS.ProcessEnv => ({
    ...process.env,
    TEXINPUTS: `.//:./:${workDir}//:${process.env['TEXINPUTS'] ?? ''}`,
    BIBINPUTS: `.//:./:${workDir}//:${process.env['BIBINPUTS'] ?? ''}`,
    BSTINPUTS: `.//:./:${workDir}//:${process.env['BSTINPUTS'] ?? ''}`,
});

const resolveCompiler = async (entrypoint: string): Promise<CompilerConfig | null> => {
    for (const compiler of buildCompilerConfigs(entrypoint)) {
        const found = await new Promise<boolean>((resolve) => {
            const proc = spawn(compiler.binary, ['--version']);
            proc.on('error', () => resolve(false));
            proc.on('close', (code) => resolve(code === 0 || code === 1));
        });

        if (found) {
            return compiler;
        }
    }

    return null;
};

const runCompiler = (compiler: CompilerConfig, workDir: string): Promise<CompilerRunResult> => {
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

const MAIN_TEX_FALLBACK = 'main.tex';

/**
 * Compiles a LaTeX document to PDF using the first available system compiler.
 *
 * Steps:
 * 1. Load the document and all associated LatexFiles.
 * 2. Auto-migrate: if no LatexFile records exist, treat `document.content` as `main.tex`.
 * 3. Write all LatexFiles to workDir respecting their `path` prefix.
 * 4. Write all assets to workDir respecting their `path` field.
 * 5. Detect an available compiler and run it against the entrypoint file.
 * 6. Buffer the output PDF, clean up the temp directory, and stream it back.
 *
 * @throws {LATEX_COMPILER_NOT_FOUND} If no LaTeX compiler is available on the system.
 * @throws {LATEX_COMPILATION_FAILED} If the compiler exits with a non-zero code.
 */
@injectable()
export class CompileLatexDocumentUseCase implements IUseCase<CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TempFileService)
        private readonly tempFileService: ITempFileService
    ) {}

    async execute(input: CompileLatexDocumentInputDTO): Promise<Result<CompileLatexDocumentOutputDTO, ApplicationError>> {
        const workDir = this.tempFileService.getDirPath(`latex-compile-${uuidv4()}`);

        try {
            const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
                input.teamId,
                input.documentId
            );

            if (!document) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }

            await this.tempFileService.ensureDir(workDir);

            // Determine entrypoint filename; fall back to legacy document.content if no files exist.
            const latexFiles = await this.latexFileRepository.findAllByDocument(input.documentId);
            let entrypointFilename = MAIN_TEX_FALLBACK;

            if (latexFiles.length === 0) {
                const content = document.props.content ?? '';
                await fs.writeFile(path.join(workDir, MAIN_TEX_FALLBACK), content, 'utf-8');
            } else {
                const entrypointFile = latexFiles.find((f) => f.props.isEntrypoint) ?? latexFiles[0];
                entrypointFilename = entrypointFile.fullPath;

                for (const file of latexFiles) {
                    const destPath = path.join(workDir, file.fullPath);
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await fs.writeFile(destPath, file.props.content, 'utf-8');
                }
            }

            const compiler = await resolveCompiler(entrypointFilename);

            if (!compiler) {
                await this.tempFileService.delete(workDir, { recursive: true });

                return Result.fail(new ApplicationError(
                    ErrorCodes.LATEX_COMPILER_NOT_FOUND,
                    'No LaTeX compiler is available on this server. Install texlive (textlive-full) (latexmk, pdflatex, xelatex, or lualatex) to enable PDF compilation.',
                    503     
                ));
            }

            const assets = await this.latexAssetRepository.findAllByDocument(input.documentId);

            for (const asset of assets) {
                try {
                    const stream = await this.storageService.getStream(
                        SYS_BUCKETS.LATEX_ASSETS,
                        asset.props.storageKey
                    );
                    const relPath = asset.props.path
                        ? sanitizeAssetPath(asset.props.path, asset.props.originalName)
                        : path.basename(asset.props.originalName);

                    const destPath = path.join(workDir, relPath);
                    await fs.mkdir(path.dirname(destPath), { recursive: true });
                    await pipeline(stream, createWriteStream(destPath));
                } catch {
                    // Skip assets that cannot be retrieved; the compiler will report missing files.
                }
            }

            const result = await runCompiler(compiler, workDir);

            if (!result.success) {
                await this.tempFileService.delete(workDir, { recursive: true });

                return Result.fail(new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    result.log || 'LaTeX compilation failed with no output.',
                    422
                ));
            }

            // The output PDF is always named after the entrypoint without extension.
            const pdfName = entrypointFilename.replace(/\.tex$/, '.pdf');
            const pdfPath = path.join(workDir, pdfName);
            const pdfBuffer = await fs.readFile(pdfPath);
            await this.tempFileService.delete(workDir, { recursive: true });

            const output = createDownloadStreamResponse({
                stream: Readable.from(pdfBuffer),
                contentType: 'application/pdf',
                filename: path.basename(pdfName),
                disposition: 'inline',
                contentLength: pdfBuffer.byteLength,
                cacheControl: 'no-cache'
            });

            return Result.ok(output);
        } catch (error) {
            await this.tempFileService.delete(workDir, { recursive: true }).catch(() => undefined);

            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to compile LaTeX document',
                500
            ));
        }
    }
};
