import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { prepareWorkDir, runCompiler, TEX_EXTENSION } from './compile-helpers';
import { AITool } from '@shared/application/ai/AITool';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';

interface ParsedLatexError {
    file: string;
    line: number;
    message: string;
};

/**
 * Parses LaTeX compiler log output to extract structured errors.
 *
 * Matches lines in the `-file-line-error` format:
 *   `./path/to/file.tex:42: error message`
 *
 * Also matches generic `! Error` lines.
 */
const parseLatexErrors = (log: string): ParsedLatexError[] => {
    const errors: ParsedLatexError[] = [];
    const lines = log.split('\n');

    const fileLineErrorRegex = /^(.+):(\d+):\s*(.+)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();

        const fileLineMatch = fileLineErrorRegex.exec(line);
        if (fileLineMatch) {
            const file = fileLineMatch[1]!.replace(/^\.\//, '');
            const lineNum = parseInt(fileLineMatch[2]!, 10);
            const message = fileLineMatch[3]!.trim();
            errors.push({ file, line: lineNum, message });
            continue;
        }

        if (line.startsWith('!')) {
            const message = line.slice(1).trim();
            let errorLine = 0;
            let errorFile = 'unknown';

            const nextLine = lines[i + 1]?.trim() ?? '';
            const locationMatch = /^l\.(\d+)/.exec(nextLine);
            if (locationMatch) {
                errorLine = parseInt(locationMatch[1]!, 10);
            }

            errors.push({
                file: errorFile,
                line: errorLine,
                message
            });
        }
    }

    return errors;
};

/**
 * Compiles a LaTeX document, parses errors from the log, and returns
 * structured error context along with the relevant file contents so the
 * AI can suggest specific fixes.
 */
@injectable()
export class FixLatexErrorsAITool extends AITool {
    readonly name = 'fix_latex_errors';
    readonly description = 'Compile a LaTeX document, parse errors from the log, and return structured error context with file contents so you can suggest and apply fixes using edit_latex_file.';
    readonly parameters = z.object({
        documentId: z.string()
    });
    protected needsApproval = true;

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
        const workDir = this.tempFileService.getDirPath(`latex-fix-${uuidv4()}`);

        try {
            const preparation = await prepareWorkDir(
                {
                    teamId: scope.teamId,
                    documentId: params.documentId,
                    workDir
                },
                {
                    latexDocumentRepository: this.latexDocumentRepository,
                    latexAssetRepository: this.latexAssetRepository,
                    latexFileRepository: this.latexFileRepository,
                    storageService: this.storageService,
                    tempFileService: this.tempFileService
                }
            );

            if (preparation.status === 'no-entrypoint') {
                return {
                    summary: 'No .tex entrypoint file found — cannot compile.',
                    data: {
                        errors: [],
                        fileContents: {}
                    }
                };
            }

            if (preparation.status === 'no-compiler') {
                return {
                    summary: 'No LaTeX compiler available on the server.',
                    data: {
                        errors: [],
                        fileContents: {}
                    }
                };
            }

            const result = await runCompiler(preparation.compiler, workDir);

            if (result.success) {
                return {
                    summary: 'Document compiled successfully — no errors found.',
                    data: {
                        errors: [],
                        fileContents: {}
                    }
                };
            }

            const errors = parseLatexErrors(result.log);

            const affectedFilenames = new Set(
                errors.map((e) => e.file).filter((f) => f !== 'unknown')
            );

            const fileContentsMap = this.buildFileContentsMap(preparation.latexFiles, affectedFilenames);

            const errorCount = errors.length;
            const summary = errorCount > 0
                ? `Compilation failed with ${errorCount} error${errorCount > 1 ? 's' : ''}. File contents included for affected files.`
                : 'Compilation failed but no structured errors could be parsed. Review the raw log.';

            return {
                summary,
                data: {
                    errors,
                    rawLog: errorCount === 0 ? result.log : undefined,
                    fileContents: fileContentsMap
                }
            };
        } finally {
            await this.tempFileService.delete(workDir, { recursive: true }).catch(() => undefined);
        }
    }

    /**
     * Builds a map of filename → content for files referenced in errors.
     * Includes fileId so the AI can call `edit_latex_file` directly.
     */
    private buildFileContentsMap(
        latexFiles: LatexFile[],
        affectedFilenames: Set<string>
    ): Record<string, string> {
        const fileContents: Record<string, string> = {};

        for (const file of latexFiles) {
            if (affectedFilenames.has(file.fullPath) || affectedFilenames.has(file.props.name)) {
                const key = `${file.fullPath} (fileId: ${file._id})`;
                fileContents[key] = file.props.content;
            }
        }

        if (Object.keys(fileContents).length === 0 && latexFiles.length > 0) {
            for (const file of latexFiles) {
                if (file.props.name.toLowerCase().endsWith(TEX_EXTENSION)) {
                    const key = `${file.fullPath} (fileId: ${file._id})`;
                    fileContents[key] = file.props.content;
                }
            }
        }

        return fileContents;
    }
}
