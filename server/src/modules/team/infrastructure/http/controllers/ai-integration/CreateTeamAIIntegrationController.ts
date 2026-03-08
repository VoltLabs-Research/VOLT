import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import CreateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/CreateTeamAIIntegrationUseCase';

const CreateTeamAIIntegrationController = createController(CreateTeamAIIntegrationUseCase, HttpStatus.Created);
export default CreateTeamAIIntegrationController;
