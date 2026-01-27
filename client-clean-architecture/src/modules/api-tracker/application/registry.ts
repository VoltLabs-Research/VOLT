import type { IApiTrackerRepository } from '../domain/repositories';

export interface ApiTrackerDependencies {
    apiTrackerRepository: IApiTrackerRepository;
}

export interface ApiTrackerUseCases {}

let dependencies: ApiTrackerDependencies | null = null;
let useCases: ApiTrackerUseCases | null = null;

const buildUseCases = (deps: ApiTrackerDependencies): ApiTrackerUseCases => ({});

export const registerApiTrackerDependencies = (deps: ApiTrackerDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getApiTrackerUseCases = (): ApiTrackerUseCases => {
    if (!dependencies) {
        throw new Error('API tracker dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
