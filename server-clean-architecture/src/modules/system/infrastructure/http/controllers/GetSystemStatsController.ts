import { injectable, inject } from 'tsyringe';
import { GetSystemStatsUseCase } from '@/src/modules/system/application/use-cases/GetSystemStatsUseCase';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';

@injectable()
export default class GetSystemStatsController extends BaseController<GetSystemStatsUseCase>{
    constructor(
        @inject(GetSystemStatsUseCase) 
        protected useCase: GetSystemStatsUseCase
    ){
        super(useCase);
    }
};
