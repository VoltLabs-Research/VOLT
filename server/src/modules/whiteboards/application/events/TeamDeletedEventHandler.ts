import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Whiteboard> {
    constructor(
        
        protected readonly repository: WhiteboardRepository,

        
        private readonly deleteWhiteboardUseCase: DeleteWhiteboardUseCase
    ) {
        super();
    }

    protected async deleteOne(whiteboardId: string, event: TeamDeletedEvent): Promise<void> {
        await this.deleteWhiteboardUseCase.execute({
            whiteboardId,
            teamId: event.payload.teamId,
            userId: event.payload.userId ?? ''
        });
    }
};
