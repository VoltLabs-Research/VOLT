import DailyActivityModel from '@modules/daily-activity/models/DailyActivityModel';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * On team / user deletion, purge that scope's daily-activity records. Backed by
 * the Mongoose {@link DailyActivityModel} directly (no repository, no DI); the
 * shared `DeleteManyOn*DeletedHandler` bases still supply the payload-key +
 * filter-field wiring.
 */
const modelDeleteMany = {
    deleteMany: async (filter: Record<string, string>): Promise<number> => {
        const result = await DailyActivityModel.deleteMany(filter);
        return result.deletedCount ?? 0;
    }
};

@Subscribe('team.deleted')
export class DailyActivityTeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    protected readonly repository = modelDeleteMany;
}

@Subscribe('user.deleted')
export class DailyActivityUserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    protected readonly repository = modelDeleteMany;
}
