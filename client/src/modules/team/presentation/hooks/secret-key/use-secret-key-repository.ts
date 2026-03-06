import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ISecretKeyRepository from '@/modules/team/domain/port/ISecretKeyRepository';

const useSecretKeyUseCases = () => {
    return {
        secretKeyRepository: useResolve<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository)
    };
};

export default useSecretKeyUseCases;
