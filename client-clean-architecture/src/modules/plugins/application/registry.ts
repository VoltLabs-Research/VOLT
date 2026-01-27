import type { IPluginRepository } from '../domain/repositories/IPluginRepository';

export interface PluginDependencies {
    pluginRepository: IPluginRepository;
}

export interface PluginUseCases {}

let dependencies: PluginDependencies | null = null;
let useCases: PluginUseCases | null = null;

const buildUseCases = (deps: PluginDependencies): PluginUseCases => ({});

export const registerPluginDependencies = (deps: PluginDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getPluginUseCases = (): PluginUseCases => {
    if (!dependencies) {
        throw new Error('Plugin dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
