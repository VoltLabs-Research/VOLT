import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Trajectory> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) protected readonly repository: ITrajectoryRepository,
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
