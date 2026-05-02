import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Trajectory> {
    constructor(
        protected readonly repository: TrajectoryRepository,
        private readonly deleteTrajectoryByIdUseCase: DeleteTrajectoryByIdUseCase
    ) {
        super();
    }

    protected async deleteOne(trajectoryId: string, event: TeamDeletedEvent): Promise<void> {
        await this.deleteTrajectoryByIdUseCase.execute({
            trajectoryId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
}
