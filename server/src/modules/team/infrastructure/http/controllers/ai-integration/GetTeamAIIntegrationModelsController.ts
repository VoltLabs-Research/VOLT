import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamAIIntegrationModelsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationModelsUseCase';

@injectable()
export default class GetTeamAIIntegrationModelsController extends BaseController<GetTeamAIIntegrationModelsUseCase> {
    constructor(
        @inject(GetTeamAIIntegrationModelsUseCase)
        useCase: GetTeamAIIntegrationModelsUseCase
    ) {
        super(useCase);
    }
}
