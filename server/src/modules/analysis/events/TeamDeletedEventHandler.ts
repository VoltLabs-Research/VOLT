import AnalysisService from '@modules/analysis/services/AnalysisService';
import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

interface AnalysisIdRecord {
    readonly _id: string;
}

class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<AnalysisIdRecord> {
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

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
