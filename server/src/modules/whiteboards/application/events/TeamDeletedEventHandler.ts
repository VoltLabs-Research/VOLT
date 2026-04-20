import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { inject, injectable } from 'tsyringe';
import type Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';

@injectable()
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Whiteboard> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        protected readonly repository: IWhiteboardRepository,

        @inject(DeleteWhiteboardUseCase)
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
