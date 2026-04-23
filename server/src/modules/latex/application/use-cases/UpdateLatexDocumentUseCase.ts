import { ErrorCodes } from '@core/constants/error-codes';
import type { UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/UpdateLatexDocumentDTO';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class UpdateLatexDocumentUseCase implements IUseCase<UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        
        private readonly latexDocumentRepository: LatexDocumentRepository
    ) {}

    async execute(input: UpdateLatexDocumentInputDTO): Promise<Result<UpdateLatexDocumentOutputDTO, ApplicationError>> {
        try {
            const existing = await this.latexDocumentRepository.findByTeamAndDocumentId(
                input.teamId,
                input.documentId
            );

            if (!existing) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }

            const patch: Record<string, unknown> = {
                updatedAt: new Date(),
                ...(input.userId === undefined ? {} : { lastEditedBy: input.userId })
            };

            if (input.title !== undefined) {
                patch.title = input.title.trim();
            }

            const updated = await this.latexDocumentRepository.updateById(
                input.documentId,
                patch
            );

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }

            return Result.ok({
                _id: updated._id,
                title: updated.props.title,
                folder: updated.props.folder,
                createdBy: updated.props.createdBy,
                lastEditedBy: updated.props.lastEditedBy,
                createdAt: updated.props.createdAt,
                updatedAt: updated.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update LaTeX document',
                500
            ));
        }
    }
};
