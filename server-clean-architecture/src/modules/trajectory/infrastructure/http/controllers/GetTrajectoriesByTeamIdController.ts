import { injectable } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTrajectoriesByTeamIdUseCase from '../../../application/use-cases/GetTrajectoriesByTeamIdUseCase';

@injectable()
export default class GetTrajectoriesByTeamIdController extends BaseController<GetTrajectoriesByTeamIdUseCase>{
    constructor(
        useCase: GetTrajectoriesByTeamIdUseCase
    ){
        super(useCase);
    }
};