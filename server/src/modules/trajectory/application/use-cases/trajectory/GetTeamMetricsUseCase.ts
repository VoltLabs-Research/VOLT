import { GetTeamMetricsInputDTO, GetTeamMetricsResultDTO } from '@modules/trajectory/application/dtos/trajectory/GetTeamMetricsDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

import TeamMetricsQueryService from '@modules/trajectory/infrastructure/services/trajectory/TeamMetricsQueryService';

@Singleton()
export default class GetTeamMetricsUseCase implements IUseCase<GetTeamMetricsInputDTO, GetTeamMetricsResultDTO, ApplicationError> {
    constructor(
        
        private readonly teamMetricsQueryService: TeamMetricsQueryService
    ) {}

    async execute(input: GetTeamMetricsInputDTO): Promise<Result<GetTeamMetricsResultDTO, ApplicationError>> {
        const metrics = await this.teamMetricsQueryService.getTeamMetrics(input.teamId);

        return Result.ok(metrics);
    }
};
