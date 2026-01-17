import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetTrajectoriesByTeamIdUseCase from '../../../application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';

@injectable()
export default class GetTrajectoriesByTeamIdController extends BaseController<GetTrajectoriesByTeamIdUseCase> {
    constructor(
        @inject(GetTrajectoriesByTeamIdUseCase) useCase: GetTrajectoriesByTeamIdUseCase
    ) {
        super(useCase);
    }
};