import type { ISearchRepository } from '../domain/repositories';

export interface SearchDependencies {
    searchRepository: ISearchRepository;
}

export interface SearchUseCases {}

let dependencies: SearchDependencies | null = null;
let useCases: SearchUseCases | null = null;

const buildUseCases = (deps: SearchDependencies): SearchUseCases => ({});

export const registerSearchDependencies = (deps: SearchDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getSearchUseCases = (): SearchUseCases => {
    if (!dependencies) {
        throw new Error('Search dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
