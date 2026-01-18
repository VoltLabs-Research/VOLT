import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';

@injectable()
export default class GetTrajectoriesByTeamIdController extends BaseController<GetTrajectoriesByTeamIdUseCase> {
    constructor(
        @inject(GetTrajectoriesByTeamIdUseCase) useCase: GetTrajectoriesByTeamIdUseCase
    ) {
        super(useCase);
    }
};