import useResolve from '@/shared/presentation/hooks/use-resolve';
import { SSH_TOKENS } from '@/modules/ssh/infrastructure/di/tokens';
import type ISSHRepository from '@/modules/ssh/domain/port/ISSHRepository';

const useSSHUseCases = () => {
    return {
        sshRepository: useResolve<ISSHRepository>(SSH_TOKENS.SSHRepository)
    };
};

export default useSSHUseCases;
