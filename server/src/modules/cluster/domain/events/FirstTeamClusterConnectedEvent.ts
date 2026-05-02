import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface FirstTeamClusterConnectedEventPayload {
    teamId: string;
    teamClusterId: string;
}

export default class FirstTeamClusterConnectedEvent extends BaseDomainEvent<FirstTeamClusterConnectedEventPayload> {
    constructor(payload: FirstTeamClusterConnectedEventPayload) {
        super('team-cluster.first-connected', payload);
    }
}
