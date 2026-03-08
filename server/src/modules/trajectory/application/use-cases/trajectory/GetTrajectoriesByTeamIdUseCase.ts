import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';

@injectable()
export default class GetTrajectoriesByTeamIdUseCase implements IUseCase<GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: GetTrajectoriesByTeamIdInputDTO): Promise<Result<GetTrajectoriesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 20, search } = input;
        
        const filter: any = { team: teamId };
        if(search){
            filter.name = { $regex: search, $options: 'i' };
        }
        
        const results = await this.trajectoryRepo.findAll({
            filter,
            populate: ['analysis', 'createdBy', 'frames.simulationCell'],
            page,
            limit
        });
        
        return Result.ok({
            ...results,
            data: results.data.map((trajectory) => toPersistedOutput(trajectory))
        });
    }
};
