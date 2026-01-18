import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';

@injectable()
export default class GetPluginExposureGLBController extends BaseController<GetPluginExposureGLBUseCase> {
    constructor(
        @inject(GetPluginExposureGLBUseCase) useCase: GetPluginExposureGLBUseCase
    ) {
        super(useCase);
    }
}
