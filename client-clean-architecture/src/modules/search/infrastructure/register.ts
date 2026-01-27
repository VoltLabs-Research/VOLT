import { registerSearchDependencies } from '../application/registry';
import { searchRepository } from './repositories/SearchRepository';

export const registerSearchInfrastructure = (): void => {
    registerSearchDependencies({
        searchRepository
    });
};
