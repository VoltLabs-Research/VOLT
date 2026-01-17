import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetPluginExposureGLBInputDTO } from '../../dtos/exposure/GetPluginExposureGLBDTO';

export interface IPluginListingService {
    getExposureGLB(exposureId: string, timestep: number): Promise<any>;
}

@injectable()
export class GetPluginExposureGLBUseCase implements IUseCase<GetPluginExposureGLBInputDTO, any> {
    constructor(
        @inject('IPluginListingService') private listingService: IPluginListingService
    ) { }

    async execute(input: GetPluginExposureGLBInputDTO): Promise<Result<any>> {
        const stream = await this.listingService.getExposureGLB(input.exposureId, input.timestep);
        return Result.ok(stream);
    }
}
