import { injectable, inject } from 'tsyringe';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class GetAnalysesByTrajectoryIdController extends BaseController<GetAnalysesByTrajectoryIdUseCase>{
    constructor(
        @inject(GetAnalysesByTrajectoryIdUseCase)
        public useCase: GetAnalysesByTrajectoryIdUseCase
    ){
        super(useCase);
    }
}
