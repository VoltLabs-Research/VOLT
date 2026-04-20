import { useQueries, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { buildKeys } from '@/shared/infrastructure/query/create-paginated-query';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessMode,
    useCanvasAccessStore,
    useCanvasDataAccess,
    withAccessMode
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SceneArtifact } from '../../api/entities/scene-artifacts';
import type {
    ListSceneArtifactsInputDTO,
    RenderableExposurePayload
} from '../../api/dtos/scene-artifacts';

type SceneArtifactsPage = PaginatedResponse<SceneArtifact | RenderableExposurePayload>;

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    sceneArtifacts: ListSceneArtifactsInputDTO;
}>(BASE_KEY);

export const SCENE_ARTIFACTS_QUERY_KEYS = {
    sceneArtifacts: KEYS.sceneArtifacts
} as const;

export const buildSceneArtifactsQueryOptions = (params: ListSceneArtifactsInputDTO) => {
    const mode = useCanvasAccessStore.getState().mode;
    const dataAccess = buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode });
    return {
        queryKey: withAccessMode(mode, KEYS.sceneArtifacts(params)),
        queryFn: () => dataAccess.listSceneArtifacts(params)
    };
};

type SceneArtifactsQueryOptions = Partial<UseQueryOptions<SceneArtifactsPage, Error, SceneArtifactsPage>>;

export const sceneArtifactsQuery = (
    params: ListSceneArtifactsInputDTO,
    options?: SceneArtifactsQueryOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQuery<SceneArtifactsPage, Error, SceneArtifactsPage>({
        ...options,
        queryKey: withAccessMode(mode, KEYS.sceneArtifacts(params)),
        queryFn: () => dataAccess.listSceneArtifacts(params)
    });
};

export const useSceneArtifactsQueries = (paramsList: ListSceneArtifactsInputDTO[]) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useQueries({
        queries: paramsList.map((params) => ({
            queryKey: withAccessMode(mode, KEYS.sceneArtifacts(params)),
            queryFn: () => dataAccess.listSceneArtifacts(params),
            staleTime: 5 * 60 * 1000,
            enabled: Boolean(params.trajectoryId),
            retry: false
        }))
    });
};
