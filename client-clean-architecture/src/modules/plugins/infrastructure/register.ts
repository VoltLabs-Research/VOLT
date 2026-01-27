import { registerPluginDependencies } from '../application/registry';
import { pluginRepository } from './repositories/PluginRepository';

export const registerPluginInfrastructure = (): void => {
    registerPluginDependencies({
        pluginRepository
    });
};
