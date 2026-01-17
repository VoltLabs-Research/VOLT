import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { GetPluginExposureChartUseCase } from '../../../../application/use-cases/exposure/GetPluginExposureChartUseCase';

@injectable()
export default class GetPluginExposureChartController extends BaseController<GetPluginExposureChartUseCase> {
    constructor(
        @inject(GetPluginExposureChartUseCase) useCase: GetPluginExposureChartUseCase
    ) {
        super(useCase);
    }
}
