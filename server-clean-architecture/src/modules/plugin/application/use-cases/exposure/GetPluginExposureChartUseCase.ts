import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetPluginExposureChartInputDTO } from '@modules/plugin/application/dtos/exposure/GetPluginExposureChartDTO';

export interface IPluginListingService {
    getExposureChart(exposureId: string, timestep: number): Promise<any>;
}

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class GetPluginExposureChartUseCase implements IUseCase<GetPluginExposureChartInputDTO, any> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingService
    ){}

    async execute(input: GetPluginExposureChartInputDTO): Promise<Result<any>> {
        const stream = await this.listingService.getExposureChart(input.exposureId, input.timestep);
        return Result.ok(stream);
    }
}
