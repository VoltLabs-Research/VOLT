import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTeamAIIntegrationModelsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationModelsUseCase';

const GetTeamAIIntegrationModelsController = createController(GetTeamAIIntegrationModelsUseCase);
export default GetTeamAIIntegrationModelsController;
