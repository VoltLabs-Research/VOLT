import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

interface TrajectoryIdentity {
    readonly _id: string;
}

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<TrajectoryIdentity> {
    #service = new TrajectoryService();

    protected readonly repository = {
        export: async (options: { filter: Record<string, string>; select?: string[] }): Promise<TrajectoryIdentity[]> => {
            const docs = await TrajectoryModel.find(options.filter).select(options.select ?? []).lean().exec();
            return docs.map((doc) => ({ _id: doc._id.toString() }));
        }
    };

    protected async deleteOne(trajectoryId: string, event: TeamDeletedEvent): Promise<void> {
        await this.#service.deleteById({
            trajectoryId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
}
