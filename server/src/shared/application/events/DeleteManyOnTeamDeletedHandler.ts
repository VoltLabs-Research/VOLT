import { DeleteManyOnEntityDeletedHandler } from '@shared/application/events/DeleteManyOnEntityDeletedHandler';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';

export abstract class DeleteManyOnTeamDeletedHandler extends DeleteManyOnEntityDeletedHandler<TeamDeletedEvent> {
    protected readonly payloadKey = 'teamId';
    protected readonly filterField = 'team';
}