import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
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
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';

interface CompilerRunResult {
    success: boolean;
    log: string;
};

interface CompilerConfig {
    binary: string;
    buildArgs: (workDir: string) => string[];
};

const SUPPORTED_COMPILERS: CompilerConfig[] = [
    {
        binary: 'pdflatex',
        buildArgs: (workDir) => [
            '-interaction=nonstopmode',
            '-halt-on-error',
            `-output-directory=${workDir}`,
            'main.tex'
        ]
    },
    {
        binary: 'xelatex',
        buildArgs: (workDir) => [
            '-interaction=nonstopmode',
            '-halt-on-error',
            `-output-directory=${workDir}`,
            'main.tex'
        ]
    },
    {
        binary: 'latexmk',
        buildArgs: (workDir) => [
            '-pdf',
            '-interaction=nonstopmode',
            '-halt-on-error',
            `-outdir=${workDir}`,
            'main.tex'
        ]
    }
];

/**
 * Resolves the first available LaTeX compiler from `SUPPORTED_COMPILERS`.
 * Returns `null` if none are installed on the system.
 */
const resolveCompiler = async (): Promise<CompilerConfig | null> => {
    for (const compiler of SUPPORTED_COMPILERS) {
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

/**
 * Spawns the LaTeX compiler process and captures stdout + stderr into a log.
 * Resolves with the exit success state and combined compiler output.
 */
const runCompiler = (compiler: CompilerConfig, workDir: string): Promise<CompilerRunResult> => {
    return new Promise((resolve) => {
        const args = compiler.buildArgs(workDir);
        const proc = spawn(compiler.binary, args, { cwd: workDir });
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
 * Compiles a LaTeX document to PDF using the first available system compiler.
 *
 * Steps:
 * 1. Resolve the LaTeX document and associated assets.
 * 2. Detect an available compiler (`pdflatex`, `xelatex`, or `latexmk`).
 * 3. Write `main.tex` and all assets into an isolated temp directory.
 * 4. Execute the compiler; on failure, surface the log as a structured error.
 * 5. Buffer the output PDF, clean up the temp directory, and stream it back.
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

            const compiler = await resolveCompiler();

            if (!compiler) {
                return Result.fail(new ApplicationError(
                    ErrorCodes.LATEX_COMPILER_NOT_FOUND,
                    'No LaTeX compiler is available on this server. Install texlive (pdflatex, xelatex, or latexmk) to enable PDF compilation.',
                    503
                ));
            }

            await this.tempFileService.ensureDir(workDir);

            const content = document.props.content ?? '';
            await fs.writeFile(path.join(workDir, 'main.tex'), content, 'utf-8');

            const assets = await this.latexAssetRepository.findAllByDocument(input.documentId);
            if (assets.length > 0) {
                const assetsDir = path.join(workDir, 'assets');
                await fs.mkdir(assetsDir, { recursive: true });

                for (const asset of assets) {
                    try {
                        const stream = await this.storageService.getStream(
                            SYS_BUCKETS.LATEX_ASSETS,
                            asset.props.storageKey
                        );
                        const destPath = path.join(assetsDir, asset.props.originalName);
                        await pipeline(stream, createWriteStream(destPath));
                    } catch {
                        // Skip assets that cannot be retrieved; the compiler will report missing files.
                    }
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

            const pdfPath = path.join(workDir, 'main.pdf');
            const pdfBuffer = await fs.readFile(pdfPath);
            await this.tempFileService.delete(workDir, { recursive: true });

            const output = createDownloadStreamResponse({
                stream: Readable.from(pdfBuffer),
                contentType: 'application/pdf',
                filename: 'main.pdf',
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
