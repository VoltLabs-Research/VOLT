import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { IMetricsService } from '@modules/system/domain/port/IMetricsService';
import { GetSystemStatsOutputDTO } from '@modules/system/application/dtos';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';

@injectable()
export class GetSystemStatsUseCase implements IUseCase<void, GetSystemStatsOutputDTO> {
    constructor(
        @inject(SYSTEM_TOKENS.MetricsService) private metricsService: IMetricsService
    ){}

    async execute(): Promise<Result<GetSystemStatsOutputDTO>> {
        let stats = await this.metricsService.getLatest();

        if (!stats) {
            stats = await this.metricsService.collect();
        }

        return Result.ok({ stats });
    }
}
