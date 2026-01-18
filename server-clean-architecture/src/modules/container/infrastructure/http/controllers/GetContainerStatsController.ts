import { injectable, inject } from 'tsyringe';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class GetContainerStatsController extends BaseController<GetContainerStatsUseCase>{
    constructor(
        @inject(GetContainerStatsUseCase)
        protected useCase: GetContainerStatsUseCase
    ){
        super(useCase);
    }
};
