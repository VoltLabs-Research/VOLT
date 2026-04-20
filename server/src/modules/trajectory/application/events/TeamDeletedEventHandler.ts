import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { inject, injectable } from 'tsyringe';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Trajectory> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        protected readonly repository: ITrajectoryRepository,

        @inject(DeleteTrajectoryByIdUseCase)
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
};
