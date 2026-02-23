import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import GetTrajectoriesByTeamIdUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoriesByTeamIdUseCase';

@injectable()
export default class GetTrajectoriesByTeamIdController extends PaginatedBaseController<GetTrajectoriesByTeamIdUseCase> {
    constructor(
        @inject(GetTrajectoriesByTeamIdUseCase) 
        useCase: GetTrajectoriesByTeamIdUseCase
    ) {
        super(useCase);
    }
}