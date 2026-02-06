export interface IDomainEvent{
    occurredOn: Date;
    name: string;
    eventId: string;
};