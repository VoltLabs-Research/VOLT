import { GetSystemStatsOutputDTO } from '@modules/system/application/dtos';
import MetricsCollector from '@modules/system/infrastructure/services/MetricsCollectorService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export class GetSystemStatsUseCase implements IUseCase<void, GetSystemStatsOutputDTO> {
    constructor(
        private metricsService: MetricsCollector
    ){}

    async execute(): Promise<Result<GetSystemStatsOutputDTO>> {
        let stats = await this.metricsService.getLatest();

        if (!stats) {
            stats = await this.metricsService.collect();
        }

        return Result.ok({ stats });
    }
}
