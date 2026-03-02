import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';
import { v4 } from 'uuid';

export interface TeamAIIntegrationCreatedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
    isEnabled: boolean;
    defaultModel?: string;
}

export default class TeamAIIntegrationCreatedEvent implements IDomainEvent {
    public readonly name = 'team-ai-integration.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamAIIntegrationCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
