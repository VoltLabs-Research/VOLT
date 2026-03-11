import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoriesByTeamIdDTO';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export default class GetTrajectoriesByTeamIdUseCase implements IUseCase<GetTrajectoriesByTeamIdInputDTO, GetTrajectoriesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ){}

    async execute(input: GetTrajectoriesByTeamIdInputDTO): Promise<Result<GetTrajectoriesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 20, search } = input;

        const filter: Record<string, unknown> = { team: teamId };
        if (input.folderId === 'root') {
            filter.folder = null;
        } else if (input.folderId) {
            filter.folder = input.folderId;
        }
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
