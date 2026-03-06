import useResolve from '@/shared/presentation/hooks/use-resolve';
import { SESSION_TOKENS } from '@/modules/session/infrastructure/di/tokens';
import type ISessionRepository from '@/modules/session/domain/port/ISessionRepository';

const useSessionUseCases = () => {
    return {
        sessionRepository: useResolve<ISessionRepository>(SESSION_TOKENS.SessionRepository)
    };
};

export default useSessionUseCases;
