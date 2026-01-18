import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetPluginExposureGLBInputDTO } from '../../dtos/exposure/GetPluginExposureGLBDTO';

export interface IPluginListingService {
    getExposureGLB(exposureId: string, timestep: number): Promise<any>;
}

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

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
