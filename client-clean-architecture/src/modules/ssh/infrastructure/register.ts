import { registerSSHDependencies } from '../application/registry';
import { sshRepository } from './repositories/SSHRepository';

export const registerSSHInfrastructure = (): void => {
    registerSSHDependencies({
        sshRepository
    });
};
