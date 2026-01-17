import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import DeleteTrajectoryByIdUseCase from '../../../application/use-cases/trajectory/DeleteTrajectoryByIdUseCase';

@injectable()
export default class DeleteTrajectoryByIdController extends BaseController<DeleteTrajectoryByIdUseCase> {
    constructor(
        @inject(DeleteTrajectoryByIdUseCase) useCase: DeleteTrajectoryByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};