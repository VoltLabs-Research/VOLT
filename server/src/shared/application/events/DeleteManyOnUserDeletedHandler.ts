import { DeleteManyOnEntityDeletedHandler } from '@shared/application/events/DeleteManyOnEntityDeletedHandler';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';

export abstract class DeleteManyOnUserDeletedHandler extends DeleteManyOnEntityDeletedHandler<UserDeletedEvent> {
    protected readonly payloadKey = 'userId';
    protected readonly filterField: string = 'user';
};
