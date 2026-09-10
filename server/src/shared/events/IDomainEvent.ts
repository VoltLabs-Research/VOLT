export interface IDomainEvent<TPayload = unknown> {
    occurredOn: Date;
    name: string;
    eventId: string;
    payload: TPayload;
}
