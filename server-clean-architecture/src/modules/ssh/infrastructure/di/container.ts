import { container } from 'tsyringe';
import { SSH_CONN_TOKENS } from './SSHConnectionTokens';
import SSHConnectionRepository from '../persistence/mongo/repositories/SSHConnectionRepository';
import SSHConnectionService from '../services/SSHConnectionService';

export const registerSSHDependencies = () => {
    container.registerSingleton(SSH_CONN_TOKENS.SSHConnectionRepository, SSHConnectionRepository);
    container.registerSingleton(SSH_CONN_TOKENS.SSHConnectionService, SSHConnectionService);
};
