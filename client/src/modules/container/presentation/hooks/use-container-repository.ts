import useResolve from '@/shared/presentation/hooks/use-resolve';
import { CONTAINER_TOKENS } from '@/modules/container/infrastructure/di/tokens';
import type IContainerRepository from '@/modules/container/domain/port/IContainerRepository';

const useContainerUseCases = () => {
    return {
        containerRepository: useResolve<IContainerRepository>(CONTAINER_TOKENS.ContainerRepository)
    };
};

export default useContainerUseCases;
