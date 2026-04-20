import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class CatalogFolderTeamCleanupHandler implements IEventHandler<TeamDeletedEvent> {
    async handle(event: TeamDeletedEvent): Promise<void> {
        await CatalogFolderModel.deleteMany({ team: event.payload.teamId });
    }
};
