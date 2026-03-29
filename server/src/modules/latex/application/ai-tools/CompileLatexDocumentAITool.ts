import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from './compile-helpers';
import { AITool } from '@shared/application/ai/AITool';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';

/**
 * Compiles a LaTeX document and returns the compilation log output.
 *
 * Unlike the HTTP compile use case (which streams a PDF), this tool
 * is designed for the AI agent — it returns textual log output so the
 * model can diagnose issues or confirm success.
 */
@injectable()
export class CompileLatexDocumentAITool extends AITool {
    readonly name = 'compile_latex_document';
    readonly description = 'Compile a LaTeX document and return the compilation log/output. Use this to check if a document compiles successfully.';
    readonly parameters = z.object({
        documentId: z.string()
    });

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
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const workDir = this.tempFileService.getDirPath(
            getDocumentCompileWorkDirSegment(scope.teamId, params.documentId)
        );

        return withDocumentCompileLock(scope.teamId, params.documentId, async () => {
            const preparation = await prepareWorkDir(
                {
                    teamId: scope.teamId,
                    documentId: params.documentId,
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
                return {
                    summary: 'Compilation failed: LaTeX document not found.',
                    data: {
                        success: false,
                        log: 'LaTeX document not found.'
                    }
                };
            }

            if (preparation.status === 'no-files') {
                return {
                    summary: 'Compilation failed: document has no LaTeX files.',
                    data: {
                        success: false,
                        log: 'This document has no LaTeX files. Create main.tex before compiling.'
                    }
                };
            }

            if (preparation.status === 'no-entrypoint') {
                return {
                    summary: 'Compilation failed: no .tex entrypoint file found.',
                    data: {
                        success: false,
                        log: 'No .tex file was found in this document. Add or select a .tex file to compile.'
                    }
                };
            }

            if (preparation.status === 'no-compiler') {
                return {
                    summary: 'Compilation failed: no LaTeX compiler available on the server.',
                    data: {
                        success: false,
                        log: 'No LaTeX compiler is available on this server. Install texlive (latexmk, pdflatex, xelatex, or lualatex).'
                    }
                };
            }

            const result = await runCompiler(preparation.compiler, workDir);

            const summary = result.success
                ? 'Compilation succeeded.'
                : 'Compilation failed. Review the log for errors.';

            return {
                summary,
                data: {
                    success: result.success,
                    log: result.log || 'No output produced.'
                }
            };
        });
    }
}
