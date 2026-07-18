import DailyActivityModel from '@modules/daily-activity/models/DailyActivityModel';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

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

class DailyActivityTeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    protected readonly repository = modelDeleteMany;
}

class DailyActivityUserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    protected readonly repository = modelDeleteMany;
}

subscribeHandler('team.deleted', new DailyActivityTeamDeletedEventHandler());
subscribeHandler('user.deleted', new DailyActivityUserDeletedEventHandler());
