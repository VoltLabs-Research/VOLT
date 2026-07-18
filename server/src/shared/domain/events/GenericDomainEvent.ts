import { BaseDomainEvent } from './BaseDomainEvent';

export class GenericDomainEvent<T> extends BaseDomainEvent<T> {
    constructor(name: string, payload: T) {
        super(name, payload);
    }
}
