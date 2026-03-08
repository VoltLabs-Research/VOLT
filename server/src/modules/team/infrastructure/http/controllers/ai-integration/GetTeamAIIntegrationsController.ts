import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTeamAIIntegrationsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationsUseCase';

const GetTeamAIIntegrationsController = createController(GetTeamAIIntegrationsUseCase);
export default GetTeamAIIntegrationsController;
