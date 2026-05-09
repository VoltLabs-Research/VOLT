import { useQueries } from '@tanstack/react-query';
import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessStore,
    withAccessMode
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SceneArtifact } from '../../api/entities/scene-artifacts/scene-artifact';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '../../api/services/scene-artifacts-service';

type SceneArtifactsPage = PaginatedResponse<SceneArtifact | RenderableExposurePayload>;

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    sceneArtifacts: ListSceneArtifactsInputDTO;
}>(BASE_KEY);

export const SCENE_ARTIFACTS_QUERY_KEYS = {
    sceneArtifacts: KEYS.sceneArtifacts
} as const;

const getSceneArtifactsKey = (params: ListSceneArtifactsInputDTO) =>
    withAccessMode(useCanvasAccessStore.getState().mode, KEYS.sceneArtifacts(params));

const fetchSceneArtifacts = (params: ListSceneArtifactsInputDTO): Promise<SceneArtifactsPage> => {
    const mode = useCanvasAccessStore.getState().mode;
    const dataAccess = buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode });
    return dataAccess.listSceneArtifacts(params);
};

export const sceneArtifactsQuery = createQuery(getSceneArtifactsKey, fetchSceneArtifacts);

// Why: the stored query key is prefixed by `withAccessMode` (canvas-access/<mode>/...)
// so invalidating with the bare `SCENE_ARTIFACTS_QUERY_KEYS.sceneArtifacts()` key
// fails the prefix match and nothing refetches.
export const invalidateSceneArtifacts = (): Promise<void> => {
    const mode = useCanvasAccessStore.getState().mode;
    return queryClient.invalidateQueries({
        queryKey: withAccessMode(mode, SCENE_ARTIFACTS_QUERY_KEYS.sceneArtifacts())
    });
};

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
