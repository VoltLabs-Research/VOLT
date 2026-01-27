import { registerAuthDependencies } from '../application/registry';
import { authRepository, tokenStorage, errorHistoryRepository, sessionRepository } from './index';

export const registerAuthInfrastructure = (): void => {
    registerAuthDependencies({
        authRepository,
        tokenStorage,
        errorHistoryRepository,
        sessionRepository
    });
};
