import { createController } from '@shared/infrastructure/http/controllers/createController';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';

const DiscoverTeamAIProviderModelsController = createController(TEAM_TOKENS.DiscoverTeamAIProviderModelsUseCase);
export default DiscoverTeamAIProviderModelsController;
