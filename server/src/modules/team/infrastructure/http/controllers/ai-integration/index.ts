import { container } from 'tsyringe';
import GetTeamAIIntegrationsController from './GetTeamAIIntegrationsController';
import CreateTeamAIIntegrationController from './CreateTeamAIIntegrationController';
import UpdateTeamAIIntegrationController from './UpdateTeamAIIntegrationController';
import DeleteTeamAIIntegrationController from './DeleteTeamAIIntegrationController';
import GetTeamAIIntegrationModelsController from './GetTeamAIIntegrationModelsController';
import DiscoverTeamAIProviderModelsController from './DiscoverTeamAIProviderModelsController';

export default {
    listByTeamId: container.resolve(GetTeamAIIntegrationsController),
    createByProvider: container.resolve(CreateTeamAIIntegrationController),
    updateByProvider: container.resolve(UpdateTeamAIIntegrationController),
    deleteByProvider: container.resolve(DeleteTeamAIIntegrationController),
    listModels: container.resolve(GetTeamAIIntegrationModelsController),
    discoverModels: container.resolve(DiscoverTeamAIProviderModelsController)
};
