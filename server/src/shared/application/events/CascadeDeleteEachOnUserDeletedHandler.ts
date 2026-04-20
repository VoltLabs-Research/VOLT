import { CascadeDeleteEachOnEntityDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnEntityDeletedHandler';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';

interface IdentifiableEntity {
    readonly _id: string;
};

export abstract class CascadeDeleteEachOnUserDeletedHandler<TEntity extends IdentifiableEntity>
    extends CascadeDeleteEachOnEntityDeletedHandler<UserDeletedEvent, TEntity> {
    protected readonly payloadKey = 'userId';
    protected readonly filterField: string = 'user';
};
