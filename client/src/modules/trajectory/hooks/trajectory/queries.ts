import trajectoryService from '../../api/services/trajectory-service';
import canvasService from '@/modules/canvas/api/services/canvas-service';
import { isTrajectoryCompleted } from '@/modules/trajectory/utils/trajectory-status';
import {
    buildKeys,
    createInfiniteQuery,
    createFolderResourceQueries,
    createInvalidatingMutation,
    createMutation,
    createPaginatedQuery,
    createQuery
} from '@/shared/query';
import { batchInvalidateQueries } from '@/shared/query/cache-utils';
import queryClient from '@/shared/query/query-client';
import { useInfiniteQuery } from '@tanstack/react-query';
import type {
    FolderCreateParams,
    FolderDeleteParams,
    FolderGetParams,
    FolderListParams,
    FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import {
    useCanvasAccessMode,
    useCanvasDataAccess,
    withAccessMode,
    currentCanvasDataAccess,
    currentAccessKey
} from '@/modules/canvas/api/access';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { CreateTrajectoryInput, DownloadTrajectoryAnalysesInput, DownloadTrajectoryInput, GetAtomsInput, GetAtomsResponse, GetPreviewInput, GetTrajectoriesInput } from '../../api/services/trajectory-service';
import type { CreateTrajectoryUploadSessionResponse } from '@volt/contracts/modules/trajectory/domain';
import type { MoveTrajectoryParams } from '../../api/services/trajectory-service';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { TrajectoryFolder } from '@volt/contracts/modules/trajectory/domain';

const BASE_KEY = 'trajectory';

interface TrajectoryQueryOptions {
    enabled?: boolean;
}

interface TrajectoryAtomsInfiniteParams extends Omit<GetAtomsInput, 'page'> {
    limit: number;
}

const KEYS = buildKeys<{
    detail: string;
    debug: void;
    simulationGrid: void;
    preview: GetPreviewInput;
    publicPreview: GetPreviewInput;
    atoms: GetAtomsInput;
    atomsInfinite: void;
    perAtom: void;
    samples: void;
    folder: FolderGetParams;
    folders: FolderListParams;
}>(BASE_KEY);

const stripTrajectoryPage = ({ page: _page, ...params }: GetTrajectoriesInput) => params;

export const trajectoryQuery = createPaginatedQuery<
    Trajectory,
    GetTrajectoriesInput,
    CreateTrajectoryInput,
    Partial<Trajectory>,
    Trajectory
>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    defaultLimit: 20,
    service: {
        list: trajectoryService.getAll,
        create: async (params) => (await trajectoryService.createUploadSession(params)).trajectory,
        update: (id, params) => trajectoryService.update({
            trajectoryId: id,
            ...params
        }),
        delete: (id) => trajectoryService.delete({ trajectoryId: id })
    },
    onUpsert: () => {
        batchInvalidateQueries([KEYS.simulationGrid()]);
    },
    onRemove: (id) => {
        queryClient.removeQueries({
            queryKey: KEYS.preview(),
            predicate: (query) => {
                const params = query.queryKey[2] as GetPreviewInput | undefined;
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

export const createTrajectoryUploadSessionMutation = createMutation<
    CreateTrajectoryUploadSessionResponse,
    CreateTrajectoryInput
>(trajectoryService.createUploadSession, (result) => {
        queryClient.removeQueries({
            queryKey: KEYS.detail(result.trajectory._id)
        });
        batchInvalidateQueries([
            trajectoryQuery.QUERY_KEYS.lists(),
            KEYS.simulationGrid()
        ]);
});

export const useTrajectoryByIdQuery = createQuery(KEYS.detail, (trajectoryId) => trajectoryService.getById({ trajectoryId }));
export const debugTrajectoriesQuery = createQuery(KEYS.debug, async (): Promise<Trajectory[]> => {
    const result = await trajectoryService.getAll({
        page: 1,
        limit: 1000
    });

    return result.data.filter(
        (trajectory: Trajectory) => isTrajectoryCompleted(trajectory.status)
            && trajectory.frames.length > 0
    );
});
export const trajectoryPreviewQuery = createQuery(KEYS.preview, trajectoryService.getPreview);
export const publicTrajectoryPreviewQuery = createQuery(KEYS.publicPreview, canvasService.getPreview);
const getAtomsWithAccess = (params: GetAtomsInput) => {
    return currentCanvasDataAccess().getAtoms(params);
};
const getAtomsKey = (params: GetAtomsInput) => currentAccessKey(KEYS.atoms(params));
export const trajectoryAtomsQuery = createQuery(getAtomsKey, getAtomsWithAccess);
const trajectorySamplesQuery = createQuery(KEYS.samples, () => trajectoryService.listSamples({}));

const trajectoryFolderQueries = createFolderResourceQueries<
    TrajectoryFolder,
    PaginatedResponse<TrajectoryFolder>,
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams
>({
    baseKey: `${BASE_KEY}-folder`,
    service: {
        listFolders: trajectoryService.listFolders,
        getFolder: trajectoryService.getFolder,
        createFolder: trajectoryService.createFolder,
        updateFolder: trajectoryService.updateFolder,
        deleteFolder: trajectoryService.deleteFolder
    },
    listingQueryKeys: [trajectoryQuery.QUERY_KEYS.lists()]
});

export const trajectoryFoldersQuery = trajectoryFolderQueries.foldersQuery;
export const trajectoryFolderQuery = trajectoryFolderQueries.folderQuery;
export const useCreateTrajectoryFolderMutation = trajectoryFolderQueries.useCreateFolderMutation;
export const useUpdateTrajectoryFolderMutation = trajectoryFolderQueries.useUpdateFolderMutation;
export const useDeleteTrajectoryFolderMutation = trajectoryFolderQueries.useDeleteFolderMutation;

export const useMoveTrajectoryMutation = createInvalidatingMutation<void, MoveTrajectoryParams>(
    trajectoryService.move,
    [trajectoryQuery.QUERY_KEYS.lists()]
);

export const useTrajectoriesInfiniteQuery = createInfiniteQuery<GetTrajectoriesInput, Trajectory>(
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
    simulationGrid: KEYS.simulationGrid,
    trajectory: KEYS.detail,
    preview: KEYS.preview,
    perAtom: KEYS.perAtom
} as const;

export const fetchTrajectoryAtoms = trajectoryAtomsQuery.fetch;
export const fetchTrajectorySamples = () => trajectorySamplesQuery.fetch(undefined);
export const useDownloadTrajectoryAnalysesMutation = createMutation<Blob, DownloadTrajectoryAnalysesInput>(trajectoryService.downloadAnalyses);
export const useDownloadTrajectoryMutation = createMutation<Blob, DownloadTrajectoryInput>(trajectoryService.download);

export const useTrajectoryAtomsInfiniteQuery = (
    params: TrajectoryAtomsInfiniteParams,
    options?: TrajectoryQueryOptions
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();

    return useInfiniteQuery({
        ...options,
        queryKey: withAccessMode(mode, [...KEYS.atomsInfinite(), params]),
        queryFn: ({ pageParam }) => dataAccess.getAtoms({
            ...params,
            page: pageParam
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage: GetAtomsResponse) => {
            if (lastPage.page < lastPage.totalPages) {
                return lastPage.page + 1;
            }

            return undefined;
        },
        enabled: options?.enabled ?? true
    });
};

export const useDownloadSampleMutation = createMutation(trajectoryService.downloadSample);
