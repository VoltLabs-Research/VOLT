import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ISecretKeyRepository from '@/modules/team/domain/ports/ISecretKeyRepository';

const useSecretKeyUseCases = () => {
    return useMemo(() => ({
        secretKeyRepository: container.resolve<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository)
    }), []);
};

export default useSecretKeyUseCases;
