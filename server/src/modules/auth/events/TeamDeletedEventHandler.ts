import UserModel from '@modules/auth/models/UserModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    async handle(event: TeamDeletedEvent): Promise<void> {
        await UserModel.updateMany(
            { teams: event.payload.teamId },
            { $pull: { teams: event.payload.teamId } }
        );
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
