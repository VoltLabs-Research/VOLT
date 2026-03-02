import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamAIIntegrationsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationsUseCase';

@injectable()
export default class GetTeamAIIntegrationsController extends BaseController<GetTeamAIIntegrationsUseCase> {
    constructor(
        @inject(GetTeamAIIntegrationsUseCase)
        useCase: GetTeamAIIntegrationsUseCase
    ) {
        super(useCase);
    }
}
