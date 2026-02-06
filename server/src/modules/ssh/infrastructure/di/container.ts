import { container } from 'tsyringe';
import { SSH_CONN_TOKENS } from './SSHConnectionTokens';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import SSHConnectionService from '@modules/ssh/infrastructure/services/SSHConnectionService';

export const registerSSHDependencies = () => {
    container.registerSingleton(SSH_CONN_TOKENS.SSHConnectionRepository, SSHConnectionRepository);
    container.registerSingleton(SSH_CONN_TOKENS.SSHConnectionService, SSHConnectionService);
};
