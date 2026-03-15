import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import CreateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/CreateTeamAIIntegrationUseCase';

const CreateTeamAIIntegrationController = createController(CreateTeamAIIntegrationUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});
export default CreateTeamAIIntegrationController;
