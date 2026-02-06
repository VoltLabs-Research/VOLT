import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import CreateTrajectoryUseCase from '@modules/trajectory/application/use-cases/trajectory/CreateTrajectoryUseCase';

@injectable()
export default class CreateTrajectoryController extends BaseController<CreateTrajectoryUseCase> {
    constructor(
        @inject(CreateTrajectoryUseCase) useCase: CreateTrajectoryUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
}
