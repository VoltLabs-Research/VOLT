import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO } from '@modules/latex/application/dtos/DeleteLatexDocumentDTO';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';

@injectable()
export class DeleteLatexDocumentUseCase implements IUseCase<DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

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
};
