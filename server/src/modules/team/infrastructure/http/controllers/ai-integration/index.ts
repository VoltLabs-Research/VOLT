import CreateTeamAIIntegrationController from './CreateTeamAIIntegrationController';
import DeleteTeamAIIntegrationController from './DeleteTeamAIIntegrationController';
import DiscoverTeamAIProviderModelsController from './DiscoverTeamAIProviderModelsController';
import GetTeamAIIntegrationModelsController from './GetTeamAIIntegrationModelsController';
import GetTeamAIIntegrationsController from './GetTeamAIIntegrationsController';
import UpdateTeamAIIntegrationController from './UpdateTeamAIIntegrationController';
import { container } from 'tsyringe';

export default {
    listByTeamId: container.resolve(GetTeamAIIntegrationsController),
    createByProvider: container.resolve(CreateTeamAIIntegrationController),
    updateByProvider: container.resolve(UpdateTeamAIIntegrationController),
    deleteByProvider: container.resolve(DeleteTeamAIIntegrationController),
    listModels: container.resolve(GetTeamAIIntegrationModelsController),
    discoverModels: container.resolve(DiscoverTeamAIProviderModelsController)
};
