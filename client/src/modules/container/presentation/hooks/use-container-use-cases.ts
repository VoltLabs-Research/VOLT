import { useMemo } from 'react';
import { container } from 'tsyringe';
import { CONTAINER_TOKENS } from '@/modules/container/infrastructure/di/tokens';
import type IContainerRepository from '@/modules/container/domain/port/IContainerRepository';

const useContainerUseCases = () => {
    return useMemo(() => ({
        containerRepository: container.resolve<IContainerRepository>(CONTAINER_TOKENS.ContainerRepository)
    }), []);
};

export default useContainerUseCases;
