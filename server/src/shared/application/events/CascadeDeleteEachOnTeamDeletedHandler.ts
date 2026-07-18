import { CascadeDeleteEachOnEntityDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnEntityDeletedHandler';
import type TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';

interface IdentifiableEntity {
    readonly _id: string;
}

export abstract class CascadeDeleteEachOnTeamDeletedHandler<TEntity extends IdentifiableEntity>
    extends CascadeDeleteEachOnEntityDeletedHandler<TeamDeletedEvent, TEntity> {
    protected readonly payloadKey = 'teamId';
    protected readonly filterField = 'team';
}
