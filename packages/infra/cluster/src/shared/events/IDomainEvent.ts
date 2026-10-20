export interface IDomainEvent<TPayload extends object = object> {
    readonly name: string;
    readonly payload: TPayload;
}
