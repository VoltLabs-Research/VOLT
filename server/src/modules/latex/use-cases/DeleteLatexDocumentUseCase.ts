import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO } from '@modules/latex/dtos/DeleteLatexDocumentDTO';
import LatexDocumentDeletedEvent from '@modules/latex/events/LatexDocumentDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteLatexDocumentUseCase implements IUseCase<DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteLatexDocumentInputDTO): Promise<DeleteLatexDocumentOutputDTO> {
        const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
            input.teamId,
            input.documentId
        );

        if (!document) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX document not found'
            );
        }

        await this.latexDocumentRepository.deleteById(input.documentId);

        await this.eventBus.publish(new LatexDocumentDeletedEvent({
            documentId: input.documentId,
            teamId: input.teamId,
            storageClusterId: document.props.storageClusterId,
            userId: input.userId ?? '',
            documentTitle: document.props.title ?? ''
        }));

        return null;
    }
}
