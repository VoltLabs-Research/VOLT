import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import GetTrajectoryByIdUseCase from '../../../application/use-cases/GetTrajectoryByIdUseCase';

@injectable()
export default class DeleteTrajectoryByIdController extends BaseController<GetTrajectoryByIdUseCase>{
    constructor(
        useCase: GetTrajectoryByIdUseCase
    ){
        super(useCase, HttpStatus.Deleted);
    }
};