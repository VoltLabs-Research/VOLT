import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTrajectoryByIdUseCase from '../../../application/use-cases/GetTrajectoryByIdUseCase';

@injectable()
export default class GetTrajectoryByIdController extends BaseController<GetTrajectoryByIdUseCase>{
    constructor(
        useCase: GetTrajectoryByIdUseCase
    ){
        super(useCase);
    }
};