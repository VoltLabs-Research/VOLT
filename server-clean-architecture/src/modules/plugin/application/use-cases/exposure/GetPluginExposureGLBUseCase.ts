import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetPluginExposureGLBInputDTO } from '@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO';

export interface IPluginListingService {
    getExposureGLB(exposureId: string, timestep: number): Promise<any>;
}

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class GetPluginExposureGLBUseCase implements IUseCase<GetPluginExposureGLBInputDTO, any> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingService
    ) { }

    async execute(input: GetPluginExposureGLBInputDTO): Promise<Result<any>> {
        const stream = await this.listingService.getExposureGLB(input.exposureId, input.timestep);
        return Result.ok(stream);
    }
}
