import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { ListLatexFilesInputDTO, ListLatexFilesOutputDTO } from '@modules/latex/application/dtos/ListLatexFilesDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';

interface MongoDuplicateKeyError {
    code?: number;
};

const isMongoDuplicateKeyError = (error: unknown): error is MongoDuplicateKeyError =>
    typeof error === 'object' && error !== null && 'code' in error;

const MAIN_TEX_NAME = 'main.tex';

const toDTO = (file: LatexFile) => ({
    _id: file._id,
    documentId: file.props.document,
    name: file.props.name,
    path: file.props.path,
    content: file.props.content,
    isEntrypoint: file.props.isEntrypoint,
    createdAt: file.props.createdAt,
    updatedAt: file.props.updatedAt
});

/**
 * Returns all LatexFile records for a document.
 *
 * **Auto-migration (lazy compat):** If no files exist yet but the document
 * has a non-empty `content` field (legacy single-file model), a `main.tex`
 * LatexFile is created transparently so existing documents continue working
 * without a destructive data migration.
 */
@injectable()
export class ListLatexFilesUseCase implements IUseCase<ListLatexFilesInputDTO, ListLatexFilesOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository
    ) {}

    async execute(input: ListLatexFilesInputDTO): Promise<Result<ListLatexFilesOutputDTO, ApplicationError>> {
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

            let files = await this.latexFileRepository.findAllByDocument(input.documentId);

            if (files.length === 0) {
                try {
                    const migratedFile = await this.latexFileRepository.create({
                        document: input.documentId,
                        team: input.teamId,
                        name: MAIN_TEX_NAME,
                        path: '',
                        content: document.props.content ?? '',
                        isEntrypoint: true,
                        createdBy: document.props.createdBy,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    files = [migratedFile];
                } catch (createError: unknown) {
                    if (isMongoDuplicateKeyError(createError) && createError.code === 11000) {
                        // Another concurrent request already seeded main.tex — re-read.
                        files = await this.latexFileRepository.findAllByDocument(input.documentId);
                    } else {
                        throw createError;
                    }
                }
            }

            return Result.ok(files.map(toDTO));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to list LaTeX files',
                500
            ));
        }
    }
};
