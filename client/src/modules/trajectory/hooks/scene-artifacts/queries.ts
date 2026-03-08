import sceneArtifactService from '../../api/services/scene-artifacts';
import {
    buildKeys,
    createQuery
} from '@/shared/infrastructure/query/create-paginated-query';
import { useQueries } from '@tanstack/react-query';
import type { ListSceneArtifactsInputDTO } from '../../api/dtos/scene-artifacts';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    sceneArtifacts: ListSceneArtifactsInputDTO;
}>(BASE_KEY);

export const SCENE_ARTIFACTS_QUERY_KEYS = {
    sceneArtifacts: KEYS.sceneArtifacts
} as const;

export const sceneArtifactsQuery = createQuery(KEYS.sceneArtifacts, sceneArtifactService.listByTrajectory);

export const buildSceneArtifactsQueryOptions = sceneArtifactsQuery.buildOptions;

export const useSceneArtifactsQueries = (paramsList: ListSceneArtifactsInputDTO[]) => {
    return useQueries({
        queries: paramsList.map((params) => ({
            ...sceneArtifactsQuery.buildOptions(params),
            staleTime: 5 * 60 * 1000,
            enabled: Boolean(params.trajectoryId),
            retry: false
        }))
    });
};
