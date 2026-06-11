import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Whiteboard> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) protected readonly repository: IWhiteboardRepository,
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
}
