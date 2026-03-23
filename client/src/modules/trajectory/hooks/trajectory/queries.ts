import trajectoryService from '../../api/services/trajectory';
import { TRAJECTORY_MODULE_QUERY_KEYS } from '../shared';
import {
    buildKeys,
    createInfiniteQuery,
    createFolderResourceQueries,
    createMutation,
    createPaginatedQuery,
    createQuery
} from '@/shared/infrastructure/query';
import { batchInvalidateQueries } from '@/shared/infrastructure/query/cache-utils';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type {
    CreateTrajectoryInputDTO,
    CreateTrajectoryOutputDTO,
    DownloadTrajectoryAnalysesInputDTO,
    DownloadTrajectoryInputDTO,
    GetAtomsInputDTO,
    GetAtomsOutputDTO,
    GetPreviewInputDTO,
    GetTrajectoriesInputDTO
} from '../../api/dtos/trajectory';
import type { CreateTrajectoryFolderParams } from '../../api/dtos/trajectory/create-trajectory-folder';
import type { DeleteTrajectoryFolderParams } from '../../api/dtos/trajectory/delete-trajectory-folder';
import type { GetTrajectoryFolderParams } from '../../api/dtos/trajectory/get-trajectory-folder';
import type { ListTrajectoryFoldersParams } from '../../api/dtos/trajectory/list-trajectory-folders';
import type { MoveTrajectoryParams } from '../../api/dtos/trajectory/move-trajectory';
import type { UpdateTrajectoryFolderParams } from '../../api/dtos/trajectory/update-trajectory-folder';
import type { Trajectory } from '../../api/entities/trajectory';
import type { TrajectoryFolder } from '../../api/entities/trajectory/trajectory-folder';
import type { InfiniteQueryOptions, QueryOptions } from '@/shared/infrastructure/query/create-paginated-query';

const BASE_KEY = 'trajectory';

interface TrajectoryQueryOptions {
    enabled?: boolean;
};

interface TrajectoryByIdParams {
    trajectoryId: string;
};

interface TrajectoryAtomsInfiniteParams extends Omit<GetAtomsInputDTO, 'page'> {
    limit: number;
};

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
        folder: GetTrajectoryFolderParams;
        folders: ListTrajectoryFoldersParams;
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
        list: trajectoryService.getAll,
        create: trajectoryService.create,
        update: (id, params) => trajectoryService.update({ trajectoryId: id, ...params }),
        delete: (id) => trajectoryService.delete({ trajectoryId: id })
    },
    onUpsert: () => {
        batchInvalidateQueries([KEYS.simulationGrid()]);
    },
    onRemove: (id) => {
        queryClient.removeQueries({
            queryKey: KEYS.preview(),
            predicate: (query) => {
                const params = query.queryKey[2];
                if (typeof params !== 'object' || params === null || !('trajectoryId' in params)) {
                    return false;
                }

                return params?.trajectoryId === id;
            }
        });
        batchInvalidateQueries([
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
export const trajectoryPreviewQuery = createQuery(KEYS.preview, trajectoryService.getPreview);
export const trajectoryAtomsQuery = createQuery(KEYS.atoms, trajectoryService.getAtoms);
export const trajectorySamplesQuery = createQuery(KEYS.samples, () => trajectoryService.listSamples({}));
export const trajectoryMetricsQuery = createQuery(KEYS.metrics, () => trajectoryService.getMetrics({}));

const trajectoryFolderQueries = createFolderResourceQueries<
    TrajectoryFolder,
    PaginatedResponse<TrajectoryFolder>,
    ListTrajectoryFoldersParams,
    GetTrajectoryFolderParams,
    CreateTrajectoryFolderParams,
    UpdateTrajectoryFolderParams,
    DeleteTrajectoryFolderParams
>({
    baseKey: `${BASE_KEY}-folder`,
    service: {
        listFolders: trajectoryService.listFolders,
        getFolder: trajectoryService.getFolder,
        createFolder: trajectoryService.createFolder,
        updateFolder: trajectoryService.updateFolder,
        deleteFolder: trajectoryService.deleteFolder
    },
    buildFolderParams: (folderId) => ({ folderId }),
    afterUpdate: () => {
        queryClient.invalidateQueries({ queryKey: trajectoryQuery.QUERY_KEYS.lists() });
    },
    afterDelete: () => {
        queryClient.invalidateQueries({ queryKey: trajectoryQuery.QUERY_KEYS.lists() });
    }
});

export const trajectoryFoldersQuery = trajectoryFolderQueries.foldersQuery;
export const trajectoryFolderQuery = trajectoryFolderQueries.folderQuery;
export const invalidateTrajectoryFoldersQuery = trajectoryFolderQueries.invalidateFoldersQuery;
export const invalidateTrajectoryFolderQuery = trajectoryFolderQueries.invalidateFolderQuery;
export const useCreateTrajectoryFolderMutation = trajectoryFolderQueries.useCreateFolderMutation;
export const useUpdateTrajectoryFolderMutation = trajectoryFolderQueries.useUpdateFolderMutation;
export const useDeleteTrajectoryFolderMutation = trajectoryFolderQueries.useDeleteFolderMutation;

export const useMoveTrajectoryMutation = createMutation<void, MoveTrajectoryParams>(
    trajectoryService.move,
    () => queryClient.invalidateQueries({ queryKey: trajectoryQuery.QUERY_KEYS.lists() })
);

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
    trajectories: trajectoryQuery.QUERY_KEYS.lists,
    trajectoriesInfinite: trajectoryQuery.QUERY_KEYS.infiniteLists,
    trajectoriesList: trajectoryQuery.QUERY_KEYS.list,
    trajectoriesInfiniteList: (params: GetTrajectoriesInputDTO) => [...trajectoryQuery.QUERY_KEYS.infiniteLists(), stripTrajectoryPage(params)] as const,
    debugTrajectories: KEYS.debug,
    simulationGrid: KEYS.simulationGrid,
    trajectory: KEYS.detail,
    trajectoryById: KEYS.detail,
    preview: KEYS.preview,
    previewByTrajectory: KEYS.preview,
    atoms: KEYS.atoms,
    atomsList: KEYS.atoms,
    perAtom: KEYS.perAtom,
    samples: KEYS.samples(),
    metrics: KEYS.metrics(),
    ...TRAJECTORY_MODULE_QUERY_KEYS
} as const;

export const buildTrajectoriesQueryOptions = trajectoryQuery.useListQuery.buildOptions;
export const fetchTrajectories = trajectoryQuery.useListQuery.fetch;

export const buildTrajectoryByIdQueryOptions = (params: TrajectoryByIdParams) => {
    return trajectoryDetailQuery.buildOptions(params.trajectoryId);
};

export const buildTrajectoryPreviewQueryOptions = trajectoryPreviewQuery.buildOptions;
export const buildTrajectoryAtomsQueryOptions = trajectoryAtomsQuery.buildOptions;
export const fetchTrajectoryAtoms = trajectoryAtomsQuery.fetch;
export const buildTrajectorySamplesQueryOptions = () => trajectorySamplesQuery.buildOptions(undefined);
export const fetchTrajectorySamples = () => trajectorySamplesQuery.fetch(undefined);
export const buildTrajectoryMetricsQueryOptions = () => trajectoryMetricsQuery.buildOptions(undefined);
export const useDownloadTrajectoryAnalysesMutation = createMutation<Blob, DownloadTrajectoryAnalysesInputDTO>(trajectoryService.downloadAnalyses);
export const useDownloadTrajectoryMutation = createMutation<Blob, DownloadTrajectoryInputDTO>(trajectoryService.download);

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
    params: TrajectoryByIdParams,
    options?: QueryOptions<Trajectory>
) => {
    return trajectoryDetailQuery(params.trajectoryId, options);
};

export const useTrajectoryAtomsInfiniteQuery = (
    params: TrajectoryAtomsInfiniteParams,
    options?: TrajectoryQueryOptions
) => {
    return useInfiniteQuery({
        ...options,
        queryKey: [...KEYS.atomsInfinite(), params],
        queryFn: ({ pageParam }) => trajectoryService.getAtoms({
            ...params,
            page: pageParam
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

export const useDownloadSampleMutation = createMutation(trajectoryService.downloadSample);
