import { container } from 'tsyringe';
import { SSH_TOKENS } from './tokens';
import SSHRepository from '../repositories/SSHRepository';
import type ISSHRepository from '../../domain/port/ISSHRepository';

export const ensureSSHDI = (): void => {
    container.register<ISSHRepository>(
        SSH_TOKENS.SSHRepository,
        SSHRepository
    );
};
