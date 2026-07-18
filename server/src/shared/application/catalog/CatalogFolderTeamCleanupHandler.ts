import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import type TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';

import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class CatalogFolderTeamCleanupHandler implements IEventHandler<TeamDeletedEvent> {
    async handle(event: TeamDeletedEvent): Promise<void> {
        await CatalogFolderModel.deleteMany({ team: event.payload.teamId });
    }
}

const catalogFolderTeamCleanupHandler = new CatalogFolderTeamCleanupHandler();
subscribeHandler('team.deleted', catalogFolderTeamCleanupHandler);

export default catalogFolderTeamCleanupHandler;
