import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO } from '@modules/latex/application/dtos/DeleteLatexDocumentDTO';
import LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteLatexDocumentUseCase implements IUseCase<DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteLatexDocumentInputDTO): Promise<Result<DeleteLatexDocumentOutputDTO, ApplicationError>> {
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

            await this.latexDocumentRepository.deleteById(input.documentId);

            await this.eventBus.publish(new LatexDocumentDeletedEvent({
                documentId: input.documentId,
                teamId: input.teamId,
                storageClusterId: document.props.storageClusterId,
                userId: input.userId ?? '',
                documentTitle: document.props.title ?? ''
            }));

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete LaTeX document',
                500
            ));
        }
    }
}
