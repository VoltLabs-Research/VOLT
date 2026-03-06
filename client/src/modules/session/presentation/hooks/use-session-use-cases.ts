import { useMemo } from 'react';
import { container } from 'tsyringe';
import { SESSION_TOKENS } from '@/modules/session/infrastructure/di/tokens';
import type ISessionRepository from '@/modules/session/domain/port/ISessionRepository';

const useSessionUseCases = () => {
    return useMemo(() => ({
        sessionRepository: container.resolve<ISessionRepository>(SESSION_TOKENS.SessionRepository)
    }), []);
};

export default useSessionUseCases;
