import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetPluginExposureChartUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureChartUseCase';

@injectable()
export default class GetPluginExposureChartController extends BaseController<GetPluginExposureChartUseCase> {
    constructor(
        @inject(GetPluginExposureChartUseCase) useCase: GetPluginExposureChartUseCase
    ) {
        super(useCase);
    }
}
