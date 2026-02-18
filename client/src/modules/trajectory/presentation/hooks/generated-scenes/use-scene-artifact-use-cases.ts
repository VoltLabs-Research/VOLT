import { useMemo } from 'react';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';
import type ISceneArtifactRepository from '../../../domain/ports/ISceneArtifactRepository';
import type ListSceneArtifactsUseCase from '../../../application/use-cases/generated-scenes/ListSceneArtifactsUseCase';

const useSceneArtifactUseCases = () => {
    return useMemo(() => ({
        sceneArtifactRepository: container.resolve<ISceneArtifactRepository>(TRAJECTORY_TOKENS.SceneArtifactRepository),
        listSceneArtifactsUseCase: container.resolve<ListSceneArtifactsUseCase>(TRAJECTORY_TOKENS.ListSceneArtifactsUseCase)
    }), []);
};

export default useSceneArtifactUseCases;
