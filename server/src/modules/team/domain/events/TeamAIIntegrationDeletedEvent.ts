import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';
import { v4 } from 'uuid';

export interface TeamAIIntegrationDeletedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
}

export default class TeamAIIntegrationDeletedEvent implements IDomainEvent {
    public readonly name = 'team-ai-integration.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamAIIntegrationDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
