import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { SSH_TOKENS } from '@/modules/ssh/infrastructure/di/tokens';
import type ISSHRepository from '@/modules/ssh/domain/ports/ISSHRepository';

const useSSHUseCases = createUseCasesHook({
    sshRepository: SSH_TOKENS.SSHRepository
}) as () => {
    sshRepository: ISSHRepository;
};

export default useSSHUseCases;
