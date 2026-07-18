import AnalysisService from '@modules/analysis/services/AnalysisService';
import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

interface AnalysisIdRecord {
    readonly _id: string;
}

/**
 * On team deletion, cascade-delete every analysis belonging to the team.
 * Enumerates ids straight from the Mongoose {@link AnalysisModel} and delegates
 * the real teardown (storage/daemon cleanup via the `analysis.deleted` event) to
 * a `new AnalysisService()` — no use case, no DI.
 */
@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<AnalysisIdRecord> {
    protected readonly repository = {
        export: async ({ filter }: { filter: Record<string, string>; select?: string[] }): Promise<AnalysisIdRecord[]> => {
            const docs = await AnalysisModel.find(filter).select('_id').exec();
            return docs.map((doc) => ({ _id: String(doc._id) }));
        }
    };

    #service?: AnalysisService;

    protected async deleteOne(analysisId: string, event: TeamDeletedEvent): Promise<void> {
        this.#service ??= new AnalysisService();
        await this.#service.deleteAnalysisById({
            analysisId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
}
