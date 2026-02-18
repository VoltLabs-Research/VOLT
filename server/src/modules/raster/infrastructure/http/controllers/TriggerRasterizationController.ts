import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { TriggerRasterizationUseCase } from '@modules/raster/application/use-cases/TriggerRasterizationUseCase';

@injectable()
export class TriggerRasterizationController extends BaseController<TriggerRasterizationUseCase> {
    constructor(
        @inject(TriggerRasterizationUseCase) useCase: TriggerRasterizationUseCase
    ){
        super(useCase);
    }
}
