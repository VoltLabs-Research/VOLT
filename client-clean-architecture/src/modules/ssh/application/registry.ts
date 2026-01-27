import type { ISSHRepository } from '../domain/repositories/ISSHRepository';

export interface SSHDependencies {
    sshRepository: ISSHRepository;
}

export interface SSHUseCases {}

let dependencies: SSHDependencies | null = null;
let useCases: SSHUseCases | null = null;

const buildUseCases = (deps: SSHDependencies): SSHUseCases => ({});

export const registerSSHDependencies = (deps: SSHDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getSSHUseCases = (): SSHUseCases => {
    if (!dependencies) {
        throw new Error('SSH dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};
