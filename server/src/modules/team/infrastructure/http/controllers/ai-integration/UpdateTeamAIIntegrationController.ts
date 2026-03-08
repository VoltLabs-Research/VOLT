import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateTeamAIIntegrationUseCase from '@modules/team/application/use-cases/ai-integration/UpdateTeamAIIntegrationUseCase';

const UpdateTeamAIIntegrationController = createController(UpdateTeamAIIntegrationUseCase);
export default UpdateTeamAIIntegrationController;
