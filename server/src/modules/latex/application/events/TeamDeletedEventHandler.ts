import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import type LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<LatexDocument> {
    constructor(
        
        protected readonly repository: LatexDocumentRepository,

        
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
};
