import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';

@injectable()
export default class GetTrajectoriesByTeamIdUseCase implements IUseCase<GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ) { }

    async execute(input: GetTrajectoriesByTeamIdInputDTO): Promise<Result<GetTrajectoriesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const results = await this.trajectoryRepo.findAll({
            filter: { team: teamId },
            populate: ['analysis', 'createdBy', 'frames.simulationCell'],
            page: 1,
            limit: 100
        });
        return Result.ok({
            ...results,
            data: results.data.map(t => t.props)
        });
    }
};