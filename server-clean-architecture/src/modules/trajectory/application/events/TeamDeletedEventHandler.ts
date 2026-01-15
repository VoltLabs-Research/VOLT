import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { TRAJECTORY_TOKENS } from '../../infrastructure/di/TrajectoryTokens';
import { ITrajectoryRepository } from '../../domain/port/ITrajectoryRepository';
import TeamDeletedEvent from '@/src/modules/team/domain/events/TeamDeletedEvent';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;

        await this.trajectoryRepository.deleteMany({ team: teamId });
    }
};