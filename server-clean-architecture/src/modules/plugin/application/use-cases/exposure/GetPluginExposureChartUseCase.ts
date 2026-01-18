import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetPluginExposureChartInputDTO } from '../../dtos/exposure/GetPluginExposureChartDTO';

export interface IPluginListingService {
    getExposureChart(exposureId: string, timestep: number): Promise<any>;
}

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

@injectable()
export class GetPluginExposureChartUseCase implements IUseCase<GetPluginExposureChartInputDTO, any> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingService
    ) { }

    async execute(input: GetPluginExposureChartInputDTO): Promise<Result<any>> {
        const stream = await this.listingService.getExposureChart(input.exposureId, input.timestep);
        return Result.ok(stream);
    }
}
