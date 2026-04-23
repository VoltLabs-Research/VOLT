import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';

import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class CatalogFolderTeamCleanupHandler implements IEventHandler<TeamDeletedEvent> {
    async handle(event: TeamDeletedEvent): Promise<void> {
        await CatalogFolderModel.deleteMany({ team: event.payload.teamId });
    }
};
