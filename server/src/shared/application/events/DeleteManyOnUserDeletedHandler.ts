import { IEventHandler } from '@shared/application/events/IEventHandler';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';

export abstract class DeleteManyOnUserDeletedHandler implements IEventHandler<UserDeletedEvent> {
    protected abstract readonly repository: { deleteMany(filter: any): Promise<any> };

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await this.repository.deleteMany({ user: userId });
    }
}
