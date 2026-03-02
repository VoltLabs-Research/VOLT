import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import CreateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/CreateTeamAIIntegrationUseCase';

@injectable()
export default class CreateTeamAIIntegrationController extends BaseController<CreateTeamAIIntegrationUseCase> {
    constructor(
        @inject(CreateTeamAIIntegrationUseCase)
        useCase: CreateTeamAIIntegrationUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
}
