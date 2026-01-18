import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteTrajectoryByIdUseCase from '@modules/trajectory/application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';

@injectable()
export default class DeleteTrajectoryByIdController extends BaseController<DeleteTrajectoryByIdUseCase> {
    constructor(
        @inject(DeleteTrajectoryByIdUseCase) useCase: DeleteTrajectoryByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};