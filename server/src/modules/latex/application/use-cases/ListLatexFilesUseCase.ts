import { ErrorCodes } from '@core/constants/error-codes';
import type { ListLatexFilesInputDTO, ListLatexFilesOutputDTO } from '@modules/latex/application/dtos/ListLatexFilesDTO';
import type LatexFile from '@modules/latex/domain/entities/LatexFile';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

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
 */
@Singleton()
export class ListLatexFilesUseCase implements IUseCase<ListLatexFilesInputDTO, ListLatexFilesOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexFileRepository: LatexFileRepository
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

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to list LaTeX files',
                500
            ));
        }
    }
}
