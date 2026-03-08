import {
    buildKeys,
    createInfiniteQuery,
    createMutation,
    createPaginatedQuery,
    createQuery,
    type InfiniteQueryOptions,
    type QueryOptions
} from '@/shared/infrastructure/query/create-paginated-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { batchInvalidateQueries } from '@/shared/infrastructure/query/cache-utils';
import { useInfiniteQuery } from '@tanstack/react-query';
import trajectoryService from '../../api/services/trajectory';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Trajectory } from '../../api/entities/trajectory';
import type { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '../../api/dtos/create-trajectory';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '../../api/dtos/get-atoms';
import type { GetPreviewInputDTO } from '../../api/dtos/get-preview';
import type { GetTrajectoriesInputDTO } from '../../api/dtos/get-trajectories';
import { COLOR_CODING_QUERY_KEYS } from '../color-coding/queries';
import { PARTICLE_FILTER_QUERY_KEYS } from '../particle-filter/queries';
import { SCENE_ARTIFACT_QUERY_KEYS } from '../scene-artifact/queries';

const BASE_KEY = 'trajectory';

const KEYS = buildKeys<{
    detail: string;
    debug: void;
    simulationGrid: void;
    preview: GetPreviewInputDTO;
    atoms: GetAtomsInputDTO;
    atomsInfinite: void;
    perAtom: void;
    samples: void;
    metrics: void;
}>(BASE_KEY);

const stripTrajectoryPage = ({ page: _page, ...params }: GetTrajectoriesInputDTO) => params;

export const trajectoryQuery = createPaginatedQuery<
    Trajectory,
    GetTrajectoriesInputDTO,
    CreateTrajectoryInputDTO,
    Partial<Trajectory>,
    CreateTrajectoryOutputDTO
>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    defaultLimit: 20,
    service: {
        list: (params) => trajectoryService.getAll(params),
        create: (params) => trajectoryService.create(params),
        update: (id, params) => trajectoryService.update({ _id: id, ...params }),
        delete: (id) => trajectoryService.delete({ _id: id })
    },
    extractEntity: (result) => result.trajectory,
    onUpsert: () => {
        void batchInvalidateQueries([
            [BASE_KEY, 'list'],
            KEYS.detail(),
            KEYS.simulationGrid()
        ]);
    },
    onRemove: (id) => {
        queryClient.removeQueries({
            queryKey: KEYS.preview(),
            predicate: (query) => {
                const params = query.queryKey[2] as GetPreviewInputDTO | undefined;
                return params?.trajectoryId === id;
            }
        });
        void batchInvalidateQueries([
            [BASE_KEY, 'list'],
            KEYS.detail(),
            KEYS.simulationGrid()
        ]);
    }
});

const trajectoryDetailQuery = createQuery(KEYS.detail, (trajectoryId) => trajectoryService.getById({ trajectoryId }));
export const debugTrajectoriesQuery = createQuery(KEYS.debug, async (): Promise<Trajectory[]> => {
    const result = await trajectoryService.getAll({ page: 1, limit: 1000 });

    return result.data.filter(
        (trajectory: Trajectory) => trajectory.status === 'completed' && trajectory.frames && trajectory.frames.length > 0
    );
});
export const trajectoryPreviewQuery = createQuery(KEYS.preview, (params) => trajectoryService.getPreview(params));
export const trajectoryAtomsQuery = createQuery(KEYS.atoms, (params) => trajectoryService.getAtoms(params));
export const trajectorySamplesQuery = createQuery(KEYS.samples, () => trajectoryService.listSamples({}));
export const trajectoryMetricsQuery = createQuery(KEYS.metrics, () => trajectoryService.getMetrics({}));

const trajectoriesInfiniteQuery = createInfiniteQuery<GetTrajectoriesInputDTO, Trajectory>(
    (params) => [...trajectoryQuery.QUERY_KEYS.infiniteLists(), stripTrajectoryPage(params)],
    (params, { page, limit }) => trajectoryService.getAll({
        ...params,
        page,
        limit: params.limit ?? limit
    }),
    { defaultLimit: 20 }
);

export const TRAJECTORY_QUERY_KEYS = {
    trajectories: () => trajectoryQuery.QUERY_KEYS.lists(),
    trajectoriesInfinite: () => trajectoryQuery.QUERY_KEYS.infiniteLists(),
    trajectoriesList: (params: GetTrajectoriesInputDTO) => trajectoryQuery.QUERY_KEYS.list(params),
    trajectoriesInfiniteList: (params: GetTrajectoriesInputDTO) => [...trajectoryQuery.QUERY_KEYS.infiniteLists(), stripTrajectoryPage(params)] as const,
    debugTrajectories: () => KEYS.debug(),
    simulationGrid: () => KEYS.simulationGrid(),
    trajectory: () => KEYS.detail(),
    trajectoryById: (trajectoryId: string) => KEYS.detail(trajectoryId),
    preview: () => KEYS.preview(),
    previewByTrajectory: (params: GetPreviewInputDTO) => KEYS.preview(params),
    atoms: () => KEYS.atoms(),
    atomsList: (params: GetAtomsInputDTO) => KEYS.atoms(params),
    perAtom: () => KEYS.perAtom(),
    samples: KEYS.samples(),
    metrics: KEYS.metrics(),
    ...COLOR_CODING_QUERY_KEYS,
    ...PARTICLE_FILTER_QUERY_KEYS,
    ...SCENE_ARTIFACT_QUERY_KEYS
} as const;

export const buildTrajectoriesQueryOptions = trajectoryQuery.useListQuery.buildOptions;
export const fetchTrajectories = trajectoryQuery.useListQuery.fetch;

export const buildTrajectoryByIdQueryOptions = (params: { trajectoryId: string }) => {
    return trajectoryDetailQuery.buildOptions(params.trajectoryId);
};

export const buildTrajectoryPreviewQueryOptions = trajectoryPreviewQuery.buildOptions;
export const buildTrajectoryAtomsQueryOptions = trajectoryAtomsQuery.buildOptions;
export const fetchTrajectoryAtoms = trajectoryAtomsQuery.fetch;
export const buildTrajectorySamplesQueryOptions = () => trajectorySamplesQuery.buildOptions(undefined);
export const fetchTrajectorySamples = () => trajectorySamplesQuery.fetch(undefined);
export const buildTrajectoryMetricsQueryOptions = () => trajectoryMetricsQuery.buildOptions(undefined);

export const useTrajectoriesQuery = trajectoryQuery.useListQuery;

export const useTrajectoriesInfiniteQuery = (
    params: GetTrajectoriesInputDTO,
    options?: InfiniteQueryOptions<PaginatedResponse<Trajectory>> & {
        getNextPageParam?: (lastPage: PaginatedResponse<Trajectory>, allPages: PaginatedResponse<Trajectory>[]) => number | undefined;
    }
) => {
    const { getNextPageParam: _getNextPageParam, ...queryOptions } = options ?? {};

    return trajectoriesInfiniteQuery(params, queryOptions);
};

export const useTrajectoryByIdQuery = (
    params: { trajectoryId: string },
    options?: QueryOptions<Trajectory>
) => {
    return trajectoryDetailQuery(params.trajectoryId, options);
};

export const useTrajectoryAtomsInfiniteQuery = (
    params: Omit<GetAtomsInputDTO, 'page'> & { limit: number },
    options?: { enabled?: boolean }
) => {
    return useInfiniteQuery({
        ...options,
        queryKey: [...KEYS.atomsInfinite(), params],
        queryFn: ({ pageParam }) => trajectoryService.getAtoms({
            ...params,
            page: pageParam as number
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage: GetAtomsOutputDTO) => {
            if (lastPage.pagination?.hasMore) {
                return (lastPage.pagination.page ?? 1) + 1;
            }

            return undefined;
        },
        enabled: options?.enabled ?? true
    });
};

export const patchTrajectoryDetailCaches = (updater: (trajectory: Trajectory) => Trajectory): void => {
    queryClient.setQueriesData<Trajectory>(
        { queryKey: KEYS.detail() },
        (current) => current ? updater(current) : current
    );
};

export const useDownloadSampleMutation = createMutation(trajectoryService.downloadSample);
