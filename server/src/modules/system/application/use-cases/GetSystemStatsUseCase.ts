import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { IMetricsService } from '@modules/system/domain/port/IMetricsService';
import { GetSystemStatsOutputDTO } from '@modules/system/application/dtos/GetSystemStatsDTO';

@injectable()
export class GetSystemStatsUseCase implements IUseCase<void, GetSystemStatsOutputDTO> {
    constructor(
        @inject('IMetricsService') private metricsService: IMetricsService
    ){}

    async execute(): Promise<Result<GetSystemStatsOutputDTO>> {
        let stats = await this.metricsService.getLatestFromRedis();

        if (!stats) {
            stats = await this.metricsService.collect();
        }

        return Result.ok({ stats });
    }
}
