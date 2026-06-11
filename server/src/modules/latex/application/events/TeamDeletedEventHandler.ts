import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import type LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<LatexDocument> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) protected readonly repository: ILatexDocumentRepository,
        private readonly deleteLatexDocumentUseCase: DeleteLatexDocumentUseCase
    ) {
        super();
    }

    protected async deleteOne(documentId: string, event: TeamDeletedEvent): Promise<void> {
        await this.deleteLatexDocumentUseCase.execute({
            documentId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
}
