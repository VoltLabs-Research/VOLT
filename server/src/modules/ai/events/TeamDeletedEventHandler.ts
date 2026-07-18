import CascadeDeleteAIConversationsHandler from '@modules/ai/events/CascadeDeleteAIConversationsHandler';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class TeamDeletedEventHandler extends CascadeDeleteAIConversationsHandler<TeamDeletedEvent> {
    protected readonly ownerField = 'teamId' as const;

    protected resolveOwnerId(event: TeamDeletedEvent): string {
        return event.payload.teamId;
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
