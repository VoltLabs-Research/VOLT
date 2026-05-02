import { ErrorCodes } from '@core/constants/error-codes';
import type { CreateLatexFileInputDTO, CreateLatexFileOutputDTO } from '@modules/latex/application/dtos/CreateLatexFileDTO';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Creates a new LatexFile within a document.
 *
 * If `isEntrypoint` is true, the existing entrypoint is cleared atomically
 * before the new file is set as entrypoint.
 */
@Singleton()
export class CreateLatexFileUseCase implements IUseCase<CreateLatexFileInputDTO, CreateLatexFileOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexFileRepository: LatexFileRepository
    ) {}

    async execute(input: CreateLatexFileInputDTO): Promise<Result<CreateLatexFileOutputDTO, ApplicationError>> {
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

            if (input.isEntrypoint) {
                await this.latexFileRepository.clearEntrypointForDocument(input.documentId);
            }

            const file = await this.latexFileRepository.create({
                document: input.documentId,
                team: input.teamId,
                name: input.name.trim(),
                path: input.path ?? '',
                content: input.content ?? '',
                isEntrypoint: input.isEntrypoint ?? false,
                createdBy: input.userId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return Result.ok({
                _id: file._id,
                documentId: file.props.document,
                name: file.props.name,
                path: file.props.path,
                content: file.props.content,
                isEntrypoint: file.props.isEntrypoint,
                createdAt: file.props.createdAt,
                updatedAt: file.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create LaTeX file',
                500
            ));
        }
    }
}
