import {
    useInfiniteQuery,
    useQuery,
    type QueryKey,
    type UseQueryOptions
} from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { createMutation, createQuery, buildKeys } from '@/shared/infrastructure/query';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessMode,
    useCanvasAccessStore,
    useCanvasDataAccess,
    withAccessMode
} from '@/modules/canvas/api/access';
import listingService from '../../api/services/listing-service';
import type {
    ExportListingByAnalysisInputDTO,
    ExportPluginListingInputDTO,
    GetAnalysisListingExportOptionsInputDTO,
    GetPluginListingInputDTO,
    GetPluginListingOutputDTO,
    GetSubListingInputDTO,
    GetSubListingOutputDTO
} from '../../api/services/listing-service';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

const listingKeys = buildKeys<{
    detail: GetPluginListingInputDTO;
}>(['plugins', 'listing']);

const listingInfiniteKeys = buildKeys<{
    detail: Omit<GetPluginListingInputDTO, 'page'> & { limit: number };
}>(['plugins', 'listing', 'infinite']);

const subListingKeys = buildKeys<Record<string, never>>(['plugins', 'subListing']);
const analysisExportOptionsKeys = buildKeys<{
    detail: GetAnalysisListingExportOptionsInputDTO;
}>(['plugins', 'analysis-export-options']);

const subListingInfiniteKeys = buildKeys<{
    detail: Omit<GetSubListingInputDTO, 'page'> & { limit: number };
}>(['plugins', 'subListing', 'infinite']);

export const LISTING_QUERY_KEYS = {
    listing: listingKeys.prefix,
    listingInfinite: listingInfiniteKeys.prefix,
    listingDetail: listingKeys.detail,
    listingInfiniteDetail: listingInfiniteKeys.detail,
    subListing: subListingKeys.prefix,
    subListingInfinite: subListingInfiniteKeys.prefix,
    subListingDetail: subListingInfiniteKeys.detail,
    analysisExportOptions: analysisExportOptionsKeys.prefix,
    analysisExportOptionsDetail: analysisExportOptionsKeys.detail
};

const buildPluginListingQueryOptions = (params: GetPluginListingInputDTO) => {
    const accessState = useCanvasAccessStore.getState();
    const dataAccess = buildCanvasDataAccess({ ...DEFAULT_CANVAS_ACCESS_STATE, mode: accessState.mode });
    const trajectoryId = params.trajectoryId ?? accessState.trajectoryId ?? '';
    return {
        queryKey: withAccessMode(accessState.mode, LISTING_QUERY_KEYS.listingDetail(params)),
        queryFn: () => dataAccess.getPluginListing({ ...params, trajectoryId })
    };
};

export const fetchPluginListing = (params: GetPluginListingInputDTO) => {
    return queryClient.fetchQuery(buildPluginListingQueryOptions(params));
};

export const usePluginListingQuery = (
    params: GetPluginListingInputDTO,
    options?: QueryOptions<GetPluginListingOutputDTO, GetPluginListingOutputDTO>
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();
    const storeTrajectoryId = useCanvasAccessStore((state) => state.trajectoryId);
    const trajectoryId = params.trajectoryId ?? storeTrajectoryId ?? '';

    return useQuery<GetPluginListingOutputDTO, Error, GetPluginListingOutputDTO, QueryKey>({
        ...options,
        queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.listingDetail(params)),
        queryFn: () => dataAccess.getPluginListing({ ...params, trajectoryId })
    });
};

export const usePluginListingInfiniteQuery = (
    params: Omit<GetPluginListingInputDTO, 'page'> & { limit: number },
    options: { getNextPageParam: (lastPage: GetPluginListingOutputDTO) => number | undefined; enabled?: boolean }
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();
    const storeTrajectoryId = useCanvasAccessStore((state) => state.trajectoryId);
    const trajectoryId = params.trajectoryId ?? storeTrajectoryId ?? '';

    return useInfiniteQuery({
        queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.listingInfiniteDetail(params)),
        queryFn: ({ pageParam }) => dataAccess.getPluginListing({
            pluginId: params.pluginId,
            exposureName: params.exposureName,
            exposureId: params.exposureId,
            trajectoryId,
            analysisId: params.analysisId,
            page: pageParam as number,
            limit: params.limit
        }),
        initialPageParam: 1,
        getNextPageParam: options.getNextPageParam,
        enabled: options.enabled
    });
};

export const useSubListingInfiniteQuery = (
    params: Omit<GetSubListingInputDTO, 'page'> & { limit: number },
    options: { getNextPageParam: (lastPage: GetSubListingOutputDTO) => number | undefined; enabled?: boolean }
) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();
    const storeTrajectoryId = useCanvasAccessStore((state) => state.trajectoryId);
    const trajectoryId = storeTrajectoryId ?? '';

    return useInfiniteQuery({
        queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.subListingDetail(params)),
        queryFn: ({ pageParam }) => dataAccess.getSubListing({
            trajectoryId,
            analysisId: params.analysisId,
            exposureId: params.exposureId,
            timestep: params.timestep,
            subListingName: params.subListingName,
            page: pageParam as number,
            limit: params.limit
        }),
        initialPageParam: 1,
        getNextPageParam: options.getNextPageParam,
        enabled: options.enabled
    });
};

export const useAnalysisListingExportOptionsQuery = createQuery(
    LISTING_QUERY_KEYS.analysisExportOptionsDetail,
    (params: GetAnalysisListingExportOptionsInputDTO) => listingService.getAnalysisListingExportOptions(params)
);

export const useExportListingMutation = createMutation<Blob, ExportPluginListingInputDTO>(listingService.exportListing);

export const useExportListingByAnalysisMutation = createMutation<Blob, ExportListingByAnalysisInputDTO>(listingService.exportListingByAnalysis);
