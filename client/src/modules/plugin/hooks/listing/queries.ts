import {
    useInfiniteQuery,
    useQueries,
    useQuery,
    type QueryKey,
    type UseQueryOptions
} from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { createMutation, buildKeys } from '@/shared/infrastructure/query';
import {
    buildCanvasDataAccess,
    DEFAULT_CANVAS_ACCESS_STATE,
    useCanvasAccessMode,
    useCanvasAccessStore,
    useCanvasDataAccess,
    withAccessMode
} from '@/modules/canvas/api/access';
import listingService from '../../api/services/listing';
import type { ExportListingByAnalysisInputDTO } from '../../api/dtos/listing/export-listing-by-analysis';
import type { ExportPluginListingInputDTO } from '../../api/dtos/listing/export-plugin-listing';
import type {
    GetAnalysisListingExportOptionsInputDTO,
    GetAnalysisListingExportOptionsOutputDTO
} from '../../api/dtos/listing/get-analysis-listing-export-options';
import type { GetPluginListingInputDTO, GetPluginListingOutputDTO } from '../../api/dtos/listing/get-plugin-listing';
import type { GetSubListingInputDTO, GetSubListingOutputDTO } from '../../api/dtos/listing/get-sub-listing';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

// ---------------------------------------------------------------------------
// buildKeys — hierarchical keys with prefix support
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LISTING_QUERY_KEYS — public facade
// ---------------------------------------------------------------------------

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

// ─── Listing queries ─────────────────────────────────────────────────────────

export const buildPluginListingQueryOptions = (params: GetPluginListingInputDTO) => {
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

export const usePluginListingSubListingQueries = (paramsList: GetPluginListingInputDTO[]) => {
    const mode = useCanvasAccessMode();
    const dataAccess = useCanvasDataAccess();
    const storeTrajectoryId = useCanvasAccessStore((state) => state.trajectoryId);

    return useQueries({
        queries: paramsList.map((params) => {
            const trajectoryId = params.trajectoryId ?? storeTrajectoryId ?? '';
            return {
                queryKey: withAccessMode(mode, LISTING_QUERY_KEYS.listingDetail(params)),
                queryFn: () => dataAccess.getPluginListing({ ...params, trajectoryId }),
                staleTime: 5 * 60 * 1000,
                enabled: Boolean(params.pluginId) && Boolean(trajectoryId),
                retry: false
            };
        })
    });
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

// ─── Sub-listing queries ─────────────────────────────────────────────────────

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

export const useAnalysisListingExportOptionsQuery = (
    params: GetAnalysisListingExportOptionsInputDTO,
    options?: QueryOptions<GetAnalysisListingExportOptionsOutputDTO, GetAnalysisListingExportOptionsOutputDTO>
) => {
    return useQuery<GetAnalysisListingExportOptionsOutputDTO, Error, GetAnalysisListingExportOptionsOutputDTO, QueryKey>({
        queryKey: LISTING_QUERY_KEYS.analysisExportOptionsDetail(params),
        queryFn: () => listingService.getAnalysisListingExportOptions(params),
        ...options
    });
};

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export const useExportListingMutation = createMutation<Blob, ExportPluginListingInputDTO>(listingService.exportListing);

export const useExportListingByAnalysisMutation = createMutation<Blob, ExportListingByAnalysisInputDTO>(listingService.exportListingByAnalysis);
