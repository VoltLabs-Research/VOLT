import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import UpdateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/UpdateTeamAIIntegrationUseCase';

@injectable()
export default class UpdateTeamAIIntegrationController extends BaseController<UpdateTeamAIIntegrationUseCase> {
    constructor(
        @inject(UpdateTeamAIIntegrationUseCase)
        useCase: UpdateTeamAIIntegrationUseCase
    ) {
        super(useCase);
    }
}
