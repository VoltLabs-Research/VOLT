import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/DeleteTeamAIIntegrationUseCase';

const DeleteTeamAIIntegrationController = createController(DeleteTeamAIIntegrationUseCase, HttpStatus.NoContent);
export default DeleteTeamAIIntegrationController;
