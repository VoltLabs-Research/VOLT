import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { IMetricsService } from '../../domain/ports/IMetricsService';
import { GetSystemStatsOutputDTO } from '../dtos/GetSystemStatsDTO';

@injectable()
export class GetSystemStatsUseCase implements IUseCase<void, GetSystemStatsOutputDTO> {
    constructor(
        @inject('IMetricsService') private metricsService: IMetricsService
    ) { }

    async execute(): Promise<Result<GetSystemStatsOutputDTO>> {
        let stats = await this.metricsService.getLatestFromRedis();

        if (!stats) {
            stats = await this.metricsService.collect();
        }

        return Result.ok({ stats });
    }
}
