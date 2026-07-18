import AnalysisService from '@modules/analysis/services/AnalysisService';
import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import { CascadeDeleteEachOnTrajectoryDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTrajectoryDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

interface AnalysisIdRecord {
    readonly _id: string;
}

/**
 * On trajectory deletion, cascade-delete every analysis of that trajectory.
 * Enumerates ids from the Mongoose {@link AnalysisModel} and delegates teardown
 * to a `new AnalysisService()` — no use case, no DI.
 */
@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler extends CascadeDeleteEachOnTrajectoryDeletedHandler<AnalysisIdRecord> {
    protected readonly repository = {
        export: async ({ filter }: { filter: Record<string, string>; select?: string[] }): Promise<AnalysisIdRecord[]> => {
            const docs = await AnalysisModel.find(filter).select('_id').exec();
            return docs.map((doc) => ({ _id: String(doc._id) }));
        }
    };

    #service?: AnalysisService;

    protected async deleteOne(analysisId: string, event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        this.#service ??= new AnalysisService();
        await this.#service.deleteAnalysisById({
            analysisId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
}
