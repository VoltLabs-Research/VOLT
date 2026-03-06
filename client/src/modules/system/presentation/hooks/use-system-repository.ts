import useResolve from '@/shared/presentation/hooks/use-resolve';
import { SYSTEM_TOKENS } from '@/modules/system/infrastructure/di/tokens';
import type ISystemRepository from '@/modules/system/domain/port/ISystemRepository';

const useSystemUseCases = () => {
    return {
        systemRepository: useResolve<ISystemRepository>(SYSTEM_TOKENS.SystemRepository)
    };
};

export default useSystemUseCases;
