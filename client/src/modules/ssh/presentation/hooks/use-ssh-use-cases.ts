import { useMemo } from 'react';
import { container } from 'tsyringe';
import { SSH_TOKENS } from '@/modules/ssh/infrastructure/di/tokens';
import type ISSHRepository from '@/modules/ssh/domain/ports/ISSHRepository';

const useSSHUseCases = () => {
    return useMemo(() => ({
        sshRepository: container.resolve<ISSHRepository>(
            SSH_TOKENS.SSHRepository
        )
    }), []);
};

export default useSSHUseCases;
