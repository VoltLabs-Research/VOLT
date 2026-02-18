import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { CONTAINER_TOKENS } from '@/modules/container/infrastructure/di/tokens';
import type IContainerRepository from '@/modules/container/domain/ports/IContainerRepository';

const useContainerUseCases = createUseCasesHook({
    containerRepository: CONTAINER_TOKENS.ContainerRepository
}) as () => {
    containerRepository: IContainerRepository;
};

export default useContainerUseCases;
