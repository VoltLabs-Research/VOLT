import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamMetricsUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTeamMetricsUseCase';

@injectable()
export default class GetTeamMetricsController extends BaseController<GetTeamMetricsUseCase> {
    constructor(
        @inject(GetTeamMetricsUseCase) useCase: GetTeamMetricsUseCase
    ) {
        super(useCase);
    }
}
