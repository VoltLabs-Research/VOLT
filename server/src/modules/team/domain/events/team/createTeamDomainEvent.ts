import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

type TeamDomainEventConstructor<TPayload> = new (payload: TPayload) => BaseDomainEvent<TPayload>;

export const createTeamDomainEvent = <TPayload>(name: string): TeamDomainEventConstructor<TPayload> => (
    class TeamDomainEvent extends BaseDomainEvent<TPayload> {
        constructor(payload: TPayload) {
            super(name, payload);
        }
    }
);
