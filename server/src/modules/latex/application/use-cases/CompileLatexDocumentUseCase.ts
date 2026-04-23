import { ErrorCodes } from '@core/constants/error-codes';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/application/ai-tools/compile-helpers';
import type { CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO } from '@modules/latex/application/dtos/CompileLatexDocumentDTO';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import TempFileService from '@shared/infrastructure/services/TempFileService';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { inject } from 'tsyringe';

@Singleton()
export class CompileLatexDocumentUseCase implements IUseCase<CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        
        private readonly latexDocumentRepository: LatexDocumentRepository,

        
        private readonly latexAssetRepository: LatexAssetRepository,

        
        private readonly latexFileRepository: LatexFileRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly tempFileService: TempFileService
    ) {}

    async execute(input: CompileLatexDocumentInputDTO): Promise<Result<CompileLatexDocumentOutputDTO, ApplicationError>> {
        const workDir = this.tempFileService.getDirPath(
            getDocumentCompileWorkDirSegment(input.teamId, input.documentId)
        );

        try {
            return await withDocumentCompileLock(input.teamId, input.documentId, async () => {
                const preparation = await prepareWorkDir(
                    {
                        teamId: input.teamId,
                        documentId: input.documentId,
                        workDir,
                        haltOnError: true
                    },
                    {
                        latexDocumentRepository: this.latexDocumentRepository,
                        latexAssetRepository: this.latexAssetRepository,
                        latexFileRepository: this.latexFileRepository,
                        storageService: this.storageService,
                        tempFileService: this.tempFileService
                    }
                );

                if (preparation.status === 'no-document') {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.RESOURCE_NOT_FOUND,
                        'LaTeX document not found'
                    ));
                }

                if (preparation.status === 'no-files') {
                    return Result.fail(new ApplicationError(
                        ErrorCodes.LATEX_COMPILATION_FAILED,
                        'This document has no LaTeX files. Create main.tex before compiling.',
                        422
                    ));
                }

                if (preparation.status === 'no-entrypoint') {
                    return Result.fail(new ApplicationError(
                        ErrorCodes.LATEX_COMPILATION_FAILED,
                        'No .tex file was found in this document. Add or select a .tex file to compile.',
                        422
                    ));
                }

                if (preparation.status === 'no-compiler') {
                    return Result.fail(new ApplicationError(
                        ErrorCodes.LATEX_COMPILER_NOT_FOUND,
                        'No LaTeX compiler is available on this server. Install texlive (textlive-full) (latexmk, pdflatex, xelatex, or lualatex) to enable PDF compilation.',
                        503
                    ));
                }

                const result = await runCompiler(preparation.compiler, workDir);
                if (!result.success) {
                    return Result.fail(new ApplicationError(
                        ErrorCodes.LATEX_COMPILATION_FAILED,
                        result.log || 'LaTeX compilation failed with no output.',
                        422
                    ));
                }

                const entrypointBaseName = path.parse(preparation.entrypointFilename).name;
                const pdfName = `${entrypointBaseName}.pdf`;
                const entrypointDir = path.dirname(preparation.entrypointFilename);
                const pdfCandidates = [path.join(workDir, pdfName)];

                if (entrypointDir !== '.') {
                    pdfCandidates.push(path.join(workDir, entrypointDir, pdfName));
                }

                let pdfBuffer: Buffer | null = null;
                for (const candidate of pdfCandidates) {
                    try {
                        pdfBuffer = await fs.readFile(candidate);
                        break;
                    } catch (err) {
                        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                            throw err;
                        }
                    }
                }

                if (!pdfBuffer) {
                    return Result.fail(new ApplicationError(
                        ErrorCodes.LATEX_COMPILATION_FAILED,
                        result.log
                            ? `${result.log}\n\nCompilation did not produce the expected PDF output (${pdfName}).`
                            : `Compilation did not produce the expected PDF output (${pdfName}).`,
                        422
                    ));
                }

                return Result.ok(createDownloadStreamResponse({
                    stream: Readable.from(pdfBuffer),
                    contentType: 'application/pdf',
                    filename: path.basename(pdfName),
                    disposition: 'inline',
                    contentLength: pdfBuffer.byteLength,
                    cacheControl: 'no-cache'
                }));
            });
        } catch (error) {
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
}
