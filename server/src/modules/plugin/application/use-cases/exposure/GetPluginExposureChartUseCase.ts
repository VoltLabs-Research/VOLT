import { IExposureMetaRepository } from '@modules/plugin/domain/ports/IExposureMetaRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Result } from '@shared/domain/ports/Result';

export interface GetPluginExposureChartInput {
    pluginId: string;
}

@injectable()
export class GetPluginExposureChartUseCase implements IUseCase<GetPluginExposureChartInput, any> {
    constructor(
        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private readonly exposureMetaRepo: IExposureMetaRepository
    ) {}

    async execute(input: GetPluginExposureChartInput): Promise<Result<any>> {
        const results = await this.exposureMetaRepo.findAll({ 
            filter: { plugin: input.pluginId },
            limit: 1000 
        });
        
        return Result.ok(results.data);
    }
}
