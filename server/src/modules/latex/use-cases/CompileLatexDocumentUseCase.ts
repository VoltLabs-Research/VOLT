import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ILatexAssetRepository } from '@modules/latex/ports/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/ports/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/ai-tools/compile-helpers';
import type { CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO } from '@modules/latex/dtos/CompileLatexDocumentDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

@Singleton()
export class CompileLatexDocumentUseCase implements IUseCase<CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        @inject(SHARED_TOKENS.TempFileService) private readonly tempFileService: ITempFileService
    ) {}

    async execute(input: CompileLatexDocumentInputDTO): Promise<CompileLatexDocumentOutputDTO> {
        const workDir = this.tempFileService.getDirPath(
            getDocumentCompileWorkDirSegment(input.teamId, input.documentId)
        );

        return withDocumentCompileLock(input.teamId, input.documentId, async () => {
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
                    objectGatewayClient: this.objectGatewayClient,
                    tempFileService: this.tempFileService
                }
            );

            if (preparation.status === 'no-document') {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                );
            }

            if (preparation.status === 'no-files') {
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    'This document has no LaTeX files. Create main.tex before compiling.',
                    422
                );
            }

            if (preparation.status === 'no-entrypoint') {
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    'No .tex file was found in this document. Add or select a .tex file to compile.',
                    422
                );
            }

            if (preparation.status === 'no-compiler') {
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILER_NOT_FOUND,
                    'No LaTeX compiler is available on this server. Install texlive (textlive-full) (latexmk, pdflatex, xelatex, or lualatex) to enable PDF compilation.',
                    503
                );
            }

            const result = await runCompiler(preparation.compiler, workDir);
            if (!result.success) {
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    result.log || 'LaTeX compilation failed with no output.',
                    422
                );
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
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    result.log
                        ? `${result.log}\n\nCompilation did not produce the expected PDF output (${pdfName}).`
                        : `Compilation did not produce the expected PDF output (${pdfName}).`,
                    422
                );
            }

            return createDownloadStreamResponse({
                stream: Readable.from(pdfBuffer),
                contentType: 'application/pdf',
                filename: path.basename(pdfName),
                disposition: 'inline',
                contentLength: pdfBuffer.byteLength,
                cacheControl: 'no-cache'
            });
        });
    }
}
