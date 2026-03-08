import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetTeamMetricsInputDTO, GetTeamMetricsResultDTO } from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';
import { ITeamMetricsQueryService } from '@modules/trajectory/domain/port/trajectory/ITeamMetricsQueryService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export default class GetTeamMetricsUseCase implements IUseCase<GetTeamMetricsInputDTO, GetTeamMetricsResultDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TeamMetricsQueryService)
        private readonly teamMetricsQueryService: ITeamMetricsQueryService
    ) {}

    async execute(input: GetTeamMetricsInputDTO): Promise<Result<GetTeamMetricsResultDTO, ApplicationError>> {
        const metrics = await this.teamMetricsQueryService.getTeamMetrics(input.teamId);

        return Result.ok(metrics);
    }
};
