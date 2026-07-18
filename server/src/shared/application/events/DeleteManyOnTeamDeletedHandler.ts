import { DeleteManyOnEntityDeletedHandler } from '@shared/application/events/DeleteManyOnEntityDeletedHandler';
import type TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';

export abstract class DeleteManyOnTeamDeletedHandler extends DeleteManyOnEntityDeletedHandler<TeamDeletedEvent> {
    protected readonly payloadKey = 'teamId';
    protected readonly filterField = 'team';
}