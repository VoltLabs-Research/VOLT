import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ListLatexFilesInputDTO, ListLatexFilesOutputDTO } from '@modules/latex/application/dtos/ListLatexFilesDTO';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

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

@Singleton()
export class ListLatexFilesUseCase implements IUseCase<ListLatexFilesInputDTO, ListLatexFilesOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository
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

            const files = await this.latexFileRepository.findAllByDocument(input.documentId);

            return Result.ok(files.map(toDTO));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            // Let the global error middleware normalize unknown errors (e.g. a Mongoose CastError
            // from a malformed id maps to 400, not a blanket 500).
            throw error;
        }
    }
}
