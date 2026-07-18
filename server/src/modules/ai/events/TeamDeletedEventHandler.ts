import CascadeDeleteAIConversationsHandler from '@modules/ai/events/CascadeDeleteAIConversationsHandler';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteAIConversationsHandler<TeamDeletedEvent> {
    protected readonly ownerField = 'teamId' as const;

    protected resolveOwnerId(event: TeamDeletedEvent): string {
        return event.payload.teamId;
    }
}
