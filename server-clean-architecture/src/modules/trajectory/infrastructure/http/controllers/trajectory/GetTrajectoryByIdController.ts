import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTrajectoryByIdUseCase from '@/src/modules/trajectory/application/use-cases/trajectory/GetTrajectoryByIdUseCase';

@injectable()
export default class GetTrajectoryByIdController extends BaseController<GetTrajectoryByIdUseCase> {
    constructor(
        @inject(GetTrajectoryByIdUseCase) useCase: GetTrajectoryByIdUseCase
    ) {
        super(useCase);
    }
};