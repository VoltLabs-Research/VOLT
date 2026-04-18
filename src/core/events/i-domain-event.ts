export interface IDomainEvent<TPayload extends object = object> {
    readonly eventId: string;
    readonly name: string;
    readonly occurredOn: Date;
    readonly payload: TPayload;
}
