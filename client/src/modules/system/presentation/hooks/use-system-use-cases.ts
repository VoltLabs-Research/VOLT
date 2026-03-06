import { useMemo } from 'react';
import { container } from 'tsyringe';
import { SYSTEM_TOKENS } from '@/modules/system/infrastructure/di/tokens';
import type ISystemRepository from '@/modules/system/domain/port/ISystemRepository';

const useSystemUseCases = () => {
    return useMemo(() => ({
        systemRepository: container.resolve<ISystemRepository>(SYSTEM_TOKENS.SystemRepository)
    }), []);
};

export default useSystemUseCases;
