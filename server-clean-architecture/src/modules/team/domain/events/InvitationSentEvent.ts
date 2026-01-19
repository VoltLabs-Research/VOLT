import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface InvitationSentEventPayload{
    teamName: string;
    invitedUserId: string;
    invitationId: string;
};

export default class InvitationSentEvent implements IDomainEvent{
    public readonly name = 'invitation.sent';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: InvitationSentEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};