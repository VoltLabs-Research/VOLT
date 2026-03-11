import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        protected readonly repository: IWhiteboardRepository
    ) {
        super();
    }
};
