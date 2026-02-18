import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';

export abstract class DeleteManyOnTeamDeletedHandler implements IEventHandler<TeamDeletedEvent> {
    protected abstract readonly repository: { deleteMany(filter: any): Promise<any> };

    async handle(event: TeamDeletedEvent): Promise<void> {
        const { teamId } = event.payload;
        await this.repository.deleteMany({ team: teamId });
    }
}
