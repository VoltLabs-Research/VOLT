import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

interface TrajectoryIdentity {
    readonly _id: string;
}

class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<TrajectoryIdentity> {
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

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
