import CreateTeamAIIntegrationController from './CreateTeamAIIntegrationController';
import DeleteTeamAIIntegrationController from './DeleteTeamAIIntegrationController';
import DiscoverTeamAIProviderModelsController from './DiscoverTeamAIProviderModelsController';
import GetTeamAIIntegrationModelsController from './GetTeamAIIntegrationModelsController';
import GetTeamAIIntegrationsController from './GetTeamAIIntegrationsController';
import UpdateTeamAIIntegrationController from './UpdateTeamAIIntegrationController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    listByTeamId: GetTeamAIIntegrationsController,
    createByProvider: CreateTeamAIIntegrationController,
    updateByProvider: UpdateTeamAIIntegrationController,
    deleteByProvider: DeleteTeamAIIntegrationController,
    listModels: GetTeamAIIntegrationModelsController,
    discoverModels: DiscoverTeamAIProviderModelsController
});