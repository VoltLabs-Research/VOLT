import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { GetTeamMetricsInputDTO, GetTeamMetricsResultDTO } from '@modules/trajectory/dtos/trajectory/GetTeamMetricsDTO';
import type { ITeamMetricsQueryService } from '@modules/trajectory/ports/trajectory/ITeamMetricsQueryService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class GetTeamMetricsUseCase implements IUseCase<GetTeamMetricsInputDTO, GetTeamMetricsResultDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TeamMetricsQueryService)
        private readonly teamMetricsQueryService: ITeamMetricsQueryService
    ) {}

    async execute(input: GetTeamMetricsInputDTO): Promise<GetTeamMetricsResultDTO> {
        return this.teamMetricsQueryService.getTeamMetrics(input.teamId);
    }
};
