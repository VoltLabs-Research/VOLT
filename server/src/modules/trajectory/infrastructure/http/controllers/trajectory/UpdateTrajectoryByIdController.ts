import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import UpdateTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/UpdateTrajectoryByIdUseCase';

@injectable()
export default class UpdateTrajectoryByIdController extends BaseController<UpdateTrajectoryByIdUseCase> {
    constructor(
        @inject(UpdateTrajectoryByIdUseCase) useCase: UpdateTrajectoryByIdUseCase
    ) {
        super(useCase);
    }
};