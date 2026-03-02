import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/DeleteTeamAIIntegrationUseCase';

@injectable()
export default class DeleteTeamAIIntegrationController extends BaseController<DeleteTeamAIIntegrationUseCase> {
    constructor(
        @inject(DeleteTeamAIIntegrationUseCase)
        useCase: DeleteTeamAIIntegrationUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
}
