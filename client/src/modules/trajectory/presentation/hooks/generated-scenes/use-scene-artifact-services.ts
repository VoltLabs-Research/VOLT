import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ISceneArtifactRepository from '../../../domain/port/ISceneArtifactRepository';
import type ListSceneArtifactsUseCase from '../../../application/use-cases/generated-scenes/ListSceneArtifactsUseCase';

const useSceneArtifactUseCases = () => {
    return {
        sceneArtifactRepository: useResolve<ISceneArtifactRepository>(TRAJECTORY_TOKENS.SceneArtifactRepository),
        listSceneArtifactsUseCase: useResolve<ListSceneArtifactsUseCase>(TRAJECTORY_TOKENS.ListSceneArtifactsUseCase)
    };
};

export default useSceneArtifactUseCases;
