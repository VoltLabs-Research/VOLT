import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ISceneArtifactRepository from '../../../domain/ports/ISceneArtifactRepository';
import type ListSceneArtifactsUseCase from '../../../application/use-cases/generated-scenes/ListSceneArtifactsUseCase';

const useSceneArtifactUseCases = createUseCasesHook({
    sceneArtifactRepository: TRAJECTORY_TOKENS.SceneArtifactRepository,
    listSceneArtifactsUseCase: TRAJECTORY_TOKENS.ListSceneArtifactsUseCase
}) as () => {
    sceneArtifactRepository: ISceneArtifactRepository;
    listSceneArtifactsUseCase: ListSceneArtifactsUseCase;
};

export default useSceneArtifactUseCases;
