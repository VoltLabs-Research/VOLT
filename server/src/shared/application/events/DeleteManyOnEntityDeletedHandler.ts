import { IEventHandler } from '@shared/application/events/IEventHandler';
import { IDomainEvent } from '@shared/application/events/IDomainEvent';

interface DeletableRepository {
    deleteMany(filter: Record<string, string>): Promise<number>;
}

export abstract class DeleteManyOnEntityDeletedHandler<TEvent extends IDomainEvent>
    implements IEventHandler<TEvent> {

    protected abstract readonly repository: DeletableRepository;
    protected abstract readonly payloadKey: string;
    protected abstract readonly filterField: string;

    async handle(event: TEvent): Promise<void> {
        const payload = event as unknown as { payload: Record<string, string> };
        const value = payload.payload[this.payloadKey];
        await this.repository.deleteMany({ [this.filterField]: value });
    }
}
